from __future__ import annotations

import http.client
import io
import socket
import ssl
import threading
import time
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

import pytest
from PIL import Image

import services.catalog_image_fetcher as catalog_fetcher
from core.settings import Settings
from services.catalog_image_fetcher import CatalogImageFetchError, _is_public_address, fetch_catalog_image, validate_catalog_url


def _settings(**overrides) -> Settings:
    values = {
        "APP_ENV": "test",
        "SESSION_CSRF_SECRET": "test-session-csrf-secret",
        "IMAGE_VISUAL_SEARCH_CONNECT_TIMEOUT_SECONDS": 0.5,
        "IMAGE_VISUAL_SEARCH_READ_TIMEOUT_SECONDS": 0.5,
        "IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS": 1.0,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), color=(20, 40, 60)).save(buffer, format="PNG")
    return buffer.getvalue()


@contextmanager
def _http_server(routes: dict[str, dict]):
    requests: list[dict[str, object]] = []

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self) -> None:
            requests.append({"path": self.path, "headers": dict(self.headers.items())})
            route = routes[self.path]
            delay = route.get("delay", 0)
            if delay:
                time.sleep(delay)
            self.send_response(route.get("status", 200))
            for name, value in route.get("headers", {}).items():
                self.send_header(name, value)
            chunks = route.get("chunks")
            body = route.get("body", b"")
            if chunks is not None:
                self.send_header("Transfer-Encoding", "chunked")
            elif "Content-Length" not in route.get("headers", {}):
                self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            try:
                if chunks is not None:
                    for chunk in chunks:
                        self.wfile.write(f"{len(chunk):X}\r\n".encode("ascii") + chunk + b"\r\n")
                    self.wfile.write(b"0\r\n\r\n")
                elif body:
                    self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, format: str, *args) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_port, requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _route_local_catalog(monkeypatch, port: int) -> None:
    original_validate = catalog_fetcher.validate_catalog_url

    def validate(url: str, configured: Settings, *, deadline: float | None = None):
        parsed = urlsplit(url)
        if parsed.hostname == "catalog.example":
            if deadline is not None:
                catalog_fetcher._remaining(deadline)
            return parsed, [
                (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("127.0.0.1", port))
            ]
        return original_validate(url, configured, deadline=deadline)

    monkeypatch.setattr(catalog_fetcher, "validate_catalog_url", validate)


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.0.1",
        "100.64.0.1",
        "169.254.1.1",
        "192.0.2.1",
        "198.18.0.1",
        "224.0.0.1",
        "240.0.0.1",
        "255.255.255.255",
        "0.0.0.0",
        "::1",
        "fe80::1",
        "fc00::1",
        "fec0::1",
        "ff02::1",
        "2001:db8::1",
        "100::1",
        "::ffff:127.0.0.1",
        "::",
    ],
)
def test_non_public_dns_destinations_are_rejected(address: str, monkeypatch) -> None:
    family = socket.AF_INET6 if ":" in address else socket.AF_INET
    socket_address = (address, 443, 0, 0) if family == socket.AF_INET6 else (address, 443)
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(family, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", socket_address)],
    )

    assert not _is_public_address(address)
    with pytest.raises(CatalogImageFetchError, match="destination"):
        validate_catalog_url("https://catalog.example/image.png")


@pytest.mark.parametrize("address", ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])
def test_public_addresses_are_accepted(address: str) -> None:
    assert _is_public_address(address)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "data:image/png;base64,x",
        "ftp://catalog.example/a.png",
        "gopher://catalog.example/a.png",
        "//catalog.example/a.png",
        "http://user@example.com/a.png",
        "http://user:password@example.com/a.png",
        "http://@example.com/a.png",
        "http:///missing",
    ],
)
def test_invalid_catalog_urls_are_rejected_before_dns(url: str, monkeypatch) -> None:
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: pytest.fail("DNS must not run"))
    with pytest.raises(CatalogImageFetchError, match="invalid_url"):
        validate_catalog_url(url)


@pytest.mark.parametrize(
    "addresses",
    [
        ["8.8.8.8", "127.0.0.1"],
        ["127.0.0.1", "8.8.8.8"],
        ["2606:4700:4700::1111", "fe80::1"],
    ],
)
def test_mixed_dns_answers_fail_closed(addresses: list[str], monkeypatch) -> None:
    def resolve(*args, **kwargs):
        results = []
        for address in addresses:
            family = socket.AF_INET6 if ":" in address else socket.AF_INET
            socket_address = (address, 443, 0, 0) if family == socket.AF_INET6 else (address, 443)
            results.append((family, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", socket_address))
        return results

    monkeypatch.setattr(socket, "getaddrinfo", resolve)
    with pytest.raises(CatalogImageFetchError, match="destination"):
        validate_catalog_url("https://catalog.example/image.png")


def test_fetcher_connects_to_the_single_validated_dns_result(monkeypatch) -> None:
    dns_calls = 0
    pinned_addresses: list[tuple] = []
    png = _png_bytes()

    def resolve(*args, **kwargs):
        nonlocal dns_calls
        dns_calls += 1
        address = "8.8.8.8" if dns_calls == 1 else "127.0.0.1"
        return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (address, 443))]

    class Response:
        status = 200
        fp = None

        def getheader(self, name: str):
            return "image/png" if name == "Content-Type" else str(len(png)) if name == "Content-Length" else None

        def read(self, amount: int) -> bytes:
            nonlocal png
            chunk, png = png[:amount], png[amount:]
            return chunk

        def close(self) -> None:
            pass

    def request(parsed, address, deadline, configured):
        pinned_addresses.append(address[4])
        return Response()

    monkeypatch.setattr(socket, "getaddrinfo", resolve)
    monkeypatch.setattr(catalog_fetcher, "_request_pinned", request)

    assert fetch_catalog_image("https://catalog.example/image.png", _settings())
    assert dns_calls == 1
    assert pinned_addresses == [("8.8.8.8", 443)]


def test_safe_redirect_revalidates_and_outbound_request_strips_credentials(monkeypatch) -> None:
    png = _png_bytes()
    routes = {
        "/redirect": {"status": 302, "headers": {"Location": "/image"}},
        "/image": {"headers": {"Content-Type": "image/png"}, "body": png},
    }
    with _http_server(routes) as (port, requests):
        _route_local_catalog(monkeypatch, port)
        monkeypatch.setenv("HTTP_PROXY", "http://proxy.invalid:9999")
        monkeypatch.setenv("HTTPS_PROXY", "http://proxy.invalid:9999")
        result = fetch_catalog_image(f"http://catalog.example:{port}/redirect", _settings())

    assert result == png
    assert [request["path"] for request in requests] == ["/redirect", "/image"]
    for request in requests:
        headers = {str(name).lower(): value for name, value in request["headers"].items()}
        assert headers["host"] == f"catalog.example:{port}"
        assert "cookie" not in headers
        assert "authorization" not in headers
        assert "proxy-authorization" not in headers
        assert "x-csrf-token" not in headers


def test_redirect_to_private_destination_and_redirect_loop_fail_closed(monkeypatch) -> None:
    routes = {
        "/private": {"status": 302, "headers": {"Location": "/unused"}},
        "/loop-a": {"status": 302, "headers": {"Location": "/loop-b"}},
        "/loop-b": {"status": 302, "headers": {"Location": "/loop-a"}},
    }
    with _http_server(routes) as (port, requests):
        routes["/private"]["headers"]["Location"] = f"http://127.0.0.1:{port}/unused"
        _route_local_catalog(monkeypatch, port)
        with pytest.raises(CatalogImageFetchError, match="destination"):
            fetch_catalog_image(f"http://catalog.example:{port}/private", _settings())
        with pytest.raises(CatalogImageFetchError, match="redirect"):
            fetch_catalog_image(
                f"http://catalog.example:{port}/loop-a",
                _settings(IMAGE_VISUAL_SEARCH_MAX_REDIRECTS=1),
            )

    assert "/unused" not in [request["path"] for request in requests]


@pytest.mark.parametrize(
    ("path", "route", "expected_category"),
    [
        (
            "/declared-large",
            {"headers": {"Content-Type": "image/png", "Content-Length": "257"}, "body": b"x" * 257},
            "body_too_large",
        ),
        (
            "/chunked-large",
            {"headers": {"Content-Type": "image/png"}, "chunks": [b"x" * 160, b"y" * 160]},
            "body_too_large",
        ),
        (
            "/spoofed",
            {"headers": {"Content-Type": "image/png"}, "body": b"not an image"},
            "invalid_image",
        ),
        (
            "/mismatch",
            {"headers": {"Content-Type": "image/jpeg"}, "body": _png_bytes()},
            "invalid_image",
        ),
        (
            "/corrupt",
            {"headers": {"Content-Type": "image/png"}, "body": _png_bytes()[:20]},
            "invalid_image",
        ),
    ],
)
def test_remote_bodies_are_bounded_and_verified(path: str, route: dict, expected_category: str, monkeypatch) -> None:
    with _http_server({path: route}) as (port, _):
        _route_local_catalog(monkeypatch, port)
        with pytest.raises(CatalogImageFetchError, match=expected_category):
            fetch_catalog_image(
                f"http://catalog.example:{port}{path}",
                _settings(IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES=256),
            )


def test_slow_response_is_cancelled_by_read_timeout(monkeypatch) -> None:
    route = {"delay": 0.1, "headers": {"Content-Type": "image/png"}, "body": _png_bytes()}
    with _http_server({"/slow": route}) as (port, _):
        _route_local_catalog(monkeypatch, port)
        with pytest.raises(CatalogImageFetchError, match="network"):
            fetch_catalog_image(
                f"http://catalog.example:{port}/slow",
                _settings(
                    IMAGE_VISUAL_SEARCH_CONNECT_TIMEOUT_SECONDS=0.02,
                    IMAGE_VISUAL_SEARCH_READ_TIMEOUT_SECONDS=0.02,
                    IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS=0.2,
                ),
            )


def test_https_uses_original_hostname_for_sni_and_brackets_ipv6_host(monkeypatch) -> None:
    sent = bytearray()
    wrapped_hostnames: list[str] = []

    class FakeSocket:
        def settimeout(self, timeout: float) -> None:
            assert timeout > 0

        def connect(self, address: tuple) -> None:
            pass

        def sendall(self, data: bytes) -> None:
            sent.extend(data)

        def close(self) -> None:
            pass

    class FakeContext:
        def wrap_socket(self, connection, *, server_hostname: str):
            wrapped_hostnames.append(server_hostname)
            return connection

    class FakeResponse:
        status = 200

        def __init__(self, connection):
            pass

        def begin(self) -> None:
            pass

    monkeypatch.setattr(socket, "socket", lambda *args: FakeSocket())
    monkeypatch.setattr(ssl, "create_default_context", lambda: FakeContext())
    monkeypatch.setattr(http.client, "HTTPResponse", FakeResponse)

    parsed = urlsplit("https://[2606:4700:4700::1111]:8443/image.png")
    address = (socket.AF_INET6, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("2606:4700:4700::1111", 8443, 0, 0))
    catalog_fetcher._request_pinned(parsed, address, time.monotonic() + 1, _settings())

    assert wrapped_hostnames == ["2606:4700:4700::1111"]
    assert b"Host: [2606:4700:4700::1111]:8443\r\n" in sent


def test_dns_that_exhausts_the_total_deadline_never_connects(monkeypatch) -> None:
    clock = [0.0]
    monkeypatch.setattr(catalog_fetcher.time, "monotonic", lambda: clock[0])

    def resolve(*args, **kwargs):
        clock[0] = 2.0
        return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("8.8.8.8", 443))]

    monkeypatch.setattr(socket, "getaddrinfo", resolve)
    monkeypatch.setattr(catalog_fetcher, "_request_pinned", lambda *args: pytest.fail("must not connect"))

    with pytest.raises(CatalogImageFetchError, match="network"):
        fetch_catalog_image(
            "https://catalog.example/image.png",
            _settings(IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS=1.0),
        )

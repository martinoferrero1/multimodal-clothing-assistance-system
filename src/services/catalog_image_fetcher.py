from __future__ import annotations

import http.client
import ipaddress
import socket
import ssl
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

from core.settings import Settings, settings
from services.image_inspection_service import ImageInspectionError, inspect_image


@dataclass(frozen=True)
class CatalogImageFetchError(Exception):
    category: str


def fetch_catalog_image(url: str, configured: Settings = settings) -> bytes:
    deadline = time.monotonic() + configured.IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS
    current_url = url
    for redirect_count in range(configured.IMAGE_VISUAL_SEARCH_MAX_REDIRECTS + 1):
        parsed, addresses = validate_catalog_url(current_url, configured, deadline=deadline)
        try:
            response = _request_pinned(parsed, addresses[0], deadline, configured)
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                response.close()
                if not location or redirect_count == configured.IMAGE_VISUAL_SEARCH_MAX_REDIRECTS:
                    raise CatalogImageFetchError("redirect")
                current_url = urljoin(current_url, location)
                continue
            if response.status < 200 or response.status >= 300:
                response.close()
                raise CatalogImageFetchError("http_status")
            content_type = (response.getheader("Content-Type") or "").split(";", maxsplit=1)[0].lower()
            content_length = response.getheader("Content-Length")
            if content_length and _content_length_exceeds_limit(content_length, configured.IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES):
                response.close()
                raise CatalogImageFetchError("body_too_large")
            data = _read_limited(response, deadline, configured)
            try:
                inspect_image(
                    data,
                    content_type,
                    configured,
                    allowed_content_types=configured.IMAGE_VISUAL_SEARCH_ALLOWED_MIME_TYPES,
                )
            except ImageInspectionError as exc:
                raise CatalogImageFetchError("invalid_image") from exc
            return data
        except CatalogImageFetchError:
            raise
        except (OSError, ssl.SSLError, http.client.HTTPException, TimeoutError):
            raise CatalogImageFetchError("network") from None
    raise CatalogImageFetchError("redirect")


def validate_catalog_url(
    url: str,
    configured: Settings = settings,
    *,
    deadline: float | None = None,
) -> tuple[object, list[tuple]]:
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        raise CatalogImageFetchError("invalid_url") from None
    if (
        parsed.scheme.lower() not in configured.IMAGE_VISUAL_SEARCH_ALLOWED_SCHEMES
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or any(character.isspace() for character in parsed.netloc)
    ):
        raise CatalogImageFetchError("invalid_url")
    host = parsed.hostname.rstrip(".").lower()
    if not host or host != parsed.hostname.rstrip(".").lower() or port is not None and not 0 < port < 65536:
        raise CatalogImageFetchError("invalid_url")
    try:
        if deadline is not None:
            _remaining(deadline)
        addresses = socket.getaddrinfo(host, port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        if deadline is not None:
            _remaining(deadline)
    except socket.gaierror:
        raise CatalogImageFetchError("dns") from None
    except TimeoutError:
        raise CatalogImageFetchError("network") from None
    if not addresses or any(not _is_public_address(address[4][0]) for address in addresses):
        raise CatalogImageFetchError("destination")
    return parsed, addresses


def _is_public_address(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    return address.is_global and not any(
        (
            address.is_private,
            address.is_loopback,
            address.is_link_local,
            address.is_multicast,
            address.is_reserved,
            address.is_unspecified,
            getattr(address, "is_site_local", False),
        )
    )


def _request_pinned(parsed, address: tuple, deadline: float, configured: Settings) -> http.client.HTTPResponse:
    remaining = _remaining(deadline)
    family, socket_type, protocol, _, socket_address = address
    connection = socket.socket(family, socket_type, protocol)
    try:
        connection.settimeout(min(remaining, configured.IMAGE_VISUAL_SEARCH_CONNECT_TIMEOUT_SECONDS))
        connection.connect(socket_address)
        if parsed.scheme == "https":
            context = ssl.create_default_context()
            connection.settimeout(min(_remaining(deadline), configured.IMAGE_VISUAL_SEARCH_CONNECT_TIMEOUT_SECONDS))
            connection = context.wrap_socket(connection, server_hostname=parsed.hostname)
        connection.settimeout(min(_remaining(deadline), configured.IMAGE_VISUAL_SEARCH_READ_TIMEOUT_SECONDS))
        host_header = f"[{parsed.hostname}]" if ":" in parsed.hostname else parsed.hostname
        default_port = 443 if parsed.scheme == "https" else 80
        if parsed.port and parsed.port != default_port:
            host_header = f"{host_header}:{parsed.port}"
        target = parsed.path or "/"
        if parsed.query:
            target = f"{target}?{parsed.query}"
        connection.sendall(
            f"GET {target} HTTP/1.1\r\nHost: {host_header}\r\nAccept: image/*\r\nUser-Agent: LookeateCatalogFetcher/1\r\nConnection: close\r\n\r\n".encode("ascii")
        )
        response = http.client.HTTPResponse(connection)
        response.begin()
        return response
    except Exception:
        connection.close()
        raise


def _read_limited(response: http.client.HTTPResponse, deadline: float, configured: Settings) -> bytes:
    chunks: list[bytes] = []
    size = 0
    try:
        while True:
            remaining = _remaining(deadline)
            response_socket = getattr(getattr(getattr(response, "fp", None), "raw", None), "_sock", None)
            if response_socket is not None:
                response_socket.settimeout(min(remaining, configured.IMAGE_VISUAL_SEARCH_READ_TIMEOUT_SECONDS))
            chunk = response.read(min(64 * 1024, configured.IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES + 1 - size))
            if not chunk:
                return b"".join(chunks)
            size += len(chunk)
            if size > configured.IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES:
                raise CatalogImageFetchError("body_too_large")
            chunks.append(chunk)
    finally:
        response.close()


def _remaining(deadline: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError
    return remaining


def _content_length_exceeds_limit(value: str, maximum: int) -> bool:
    try:
        return int(value) > maximum
    except ValueError:
        return True

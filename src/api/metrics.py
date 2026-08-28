from __future__ import annotations

import threading
import time
from collections import defaultdict


class RuntimeMetrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.requests = 0
        self.errors = 0
        self.dependency_failures = 0
        self.latency_seconds = 0.0
        self.readiness_failures = 0
        self._routes: defaultdict[str, int] = defaultdict(int)
        self._store_identity_events: defaultdict[tuple[str, str], int] = defaultdict(int)

    def observe_request(self, route: str, duration: float, status_code: int) -> None:
        with self._lock:
            self.requests += 1
            self.latency_seconds += duration
            self._routes[route] += 1
            if status_code >= 500:
                self.errors += 1

    def observe_dependency_failure(self) -> None:
        with self._lock:
            self.dependency_failures += 1

    def observe_readiness_failure(self) -> None:
        with self._lock:
            self.readiness_failures += 1

    def observe_store_identity_event(self, event: str, outcome: str) -> None:
        with self._lock:
            self._store_identity_events[(event, outcome)] += 1

    def prometheus(self) -> str:
        with self._lock:
            average = self.latency_seconds / self.requests if self.requests else 0.0
            return "\n".join(
                (
                    "# HELP lookeate_http_requests_total Total HTTP requests.",
                    "# TYPE lookeate_http_requests_total counter",
                    f"lookeate_http_requests_total {self.requests}",
                    "# HELP lookeate_http_errors_total HTTP 5xx responses.",
                    "# TYPE lookeate_http_errors_total counter",
                    f"lookeate_http_errors_total {self.errors}",
                    "# HELP lookeate_http_request_latency_seconds_average Average request latency.",
                    "# TYPE lookeate_http_request_latency_seconds_average gauge",
                    f"lookeate_http_request_latency_seconds_average {average}",
                    "# TYPE lookeate_dependency_failures_total counter",
                    f"lookeate_dependency_failures_total {self.dependency_failures}",
                    "# TYPE lookeate_readiness_failures_total counter",
                    f"lookeate_readiness_failures_total {self.readiness_failures}",
                    "# HELP lookeate_store_identity_events_total Non-PII commercial identity events.",
                    "# TYPE lookeate_store_identity_events_total counter",
                    *(
                        f'lookeate_store_identity_events_total{{event="{event}",outcome="{outcome}"}} {count}'
                        for (event, outcome), count in sorted(self._store_identity_events.items())
                    ),
                    "",
                )
            )


def monotonic_seconds() -> float:
    return time.monotonic()

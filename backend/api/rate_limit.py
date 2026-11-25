"""In-memory sliding-window rate limiter dependency for FastAPI routes."""
from collections import defaultdict, deque
import hashlib
import threading
import time
from typing import Deque, Dict, List

from fastapi import HTTPException, Request

_LIMITERS: List["RateLimiter"] = []


class RateLimiter:
    """Thread-safe sliding-window rate limiter keyed by caller identity or IP.

    Designed as a lightweight FastAPI ``Depends(...)`` guard to throttle costly
    endpoints (LLM verification, prompt enhancement, regression runs, and uploads).
    """

    def __init__(self, max_requests: int, window_seconds: int = 60) -> None:
        """Initializes the rate limiter window and registers it for test resets.

        Args:
            max_requests: Maximum permitted requests per key inside the window.
            window_seconds: Sliding time window length in seconds.
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        _LIMITERS.append(self)

    @staticmethod
    def _client_key(request: Request) -> str:
        """Derives a privacy-safe rate-limit bucket key without logging secrets."""
        auth = request.headers.get("authorization") or request.headers.get("x-api-key")
        if auth:
            digest = hashlib.sha256(auth.encode("utf-8")).hexdigest()[:16]
            return f"cred:{digest}"
        host = request.client.host if request.client else "local"
        return f"ip:{host}"

    def check(self, key: str, *, now: float | None = None) -> None:
        """Records one request hit for ``key`` or raises HTTP 429 when capped.

        Args:
            key: Caller bucket identifier.
            now: Optional monotonic clock override for deterministic unit tests.

        Raises:
            HTTPException: 429 Too Many Requests when ``max_requests`` is exceeded.
        """
        ts = time.monotonic() if now is None else now
        cutoff = ts - self.window_seconds
        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="בוצעו יותר מדי בקשות בזמן קצר. נא להמתין מעט ולנסות שוב.",
                )
            bucket.append(ts)

    def reset(self) -> None:
        """Clears all recorded rate-limit buckets."""
        with self._lock:
            self._hits.clear()

    async def __call__(self, request: Request) -> None:
        """FastAPI dependency hook enforcing per-caller request throttling.

        Args:
            request: Incoming FastAPI HTTP request.
        """
        self.check(self._client_key(request))


def reset_all_limiters() -> None:
    """Resets every registered ``RateLimiter`` instance (useful between test suites)."""
    for limiter in _LIMITERS:
        limiter.reset()

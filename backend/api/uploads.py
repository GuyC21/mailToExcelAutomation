"""Bounded reading of uploaded files and request bodies.

``UploadFile.read()`` with no argument loads the whole file into memory, so a
size check done *after* it protects nothing. Everything here reads in chunks
and stops as soon as a limit is crossed.
"""
from typing import Optional

from fastapi import HTTPException, UploadFile
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_CHUNK = 1024 * 1024
MB = 1024 * 1024


class UploadTooLargeError(ValueError):
    """The upload exceeded its byte limit (nothing beyond the limit was kept)."""


async def read_upload_limited(upload: UploadFile, max_bytes: int) -> bytes:
    """Reads ``upload`` fully, but never more than ``max_bytes``.

    Raises:
        UploadTooLargeError: If the file is larger than ``max_bytes``.
    """
    known_size: Optional[int] = getattr(upload, "size", None)
    if known_size is not None and known_size > max_bytes:
        raise UploadTooLargeError(known_size)
    buffer = bytearray()
    while True:
        chunk = await upload.read(_CHUNK)
        if not chunk:
            return bytes(buffer)
        buffer.extend(chunk)
        if len(buffer) > max_bytes:
            raise UploadTooLargeError(len(buffer))


async def read_upload_or_413(upload: UploadFile, max_bytes: int, what: str = "הקובץ") -> bytes:
    """``read_upload_limited`` for routes where an oversized file rejects the request."""
    try:
        return await read_upload_limited(upload, max_bytes)
    except UploadTooLargeError as error:
        raise HTTPException(status_code=413,
                            detail=f"{what} גדול מהמותר ({max_bytes // MB}MB)") from error


class BodySizeLimitMiddleware:
    """Rejects request bodies larger than ``max_bytes`` with HTTP 413.

    Checks ``Content-Length`` up front and also counts the streamed bytes, so
    a chunked request without (or lying about) ``Content-Length`` is stopped
    too, before the multipart parser spools it to disk.
    """

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = 0
                if declared > self.max_bytes:
                    await self._reject(send)
                    return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge(self.max_bytes)
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await self._reject(send)

    async def _reject(self, send: Send) -> None:
        body = ('{"detail":"הבקשה גדולה מהמותר (%dMB)"}' % (self.max_bytes // MB)).encode("utf-8")
        await send({"type": "http.response.start", "status": 413,
                    "headers": [(b"content-type", b"application/json; charset=utf-8"),
                                (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})


class _BodyTooLarge(HTTPException):
    """Raised from ``receive`` when the limit is crossed mid-stream.

    It is an ``HTTPException`` on purpose: FastAPI re-raises those unchanged
    while parsing a body (anything else becomes a generic 400), so the client
    gets a proper 413 through the normal exception handlers.
    """

    def __init__(self, max_bytes: int) -> None:
        super().__init__(status_code=413, detail=f"הבקשה גדולה מהמותר ({max_bytes // MB}MB)")

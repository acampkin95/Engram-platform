import asyncio
import ipaddress
import logging
import socket
import uuid
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

BLOCKED_SCHEMES = {"file", "ftp", "gopher", "data", "javascript"}

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "169.254.169.254",
}

BLOCKED_HOSTNAME_SUFFIXES = (
    ".local",
    ".internal",
    ".localhost",
)

PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _is_private_ip(ip_str: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip_str)
        return any(addr in net for net in PRIVATE_NETWORKS)
    except ValueError:
        return False


async def validate_url(url: str) -> bool:
    parsed = urlparse(url)

    if not parsed.scheme or not parsed.hostname:
        raise ValueError("Malformed URL: missing scheme or hostname")

    if parsed.scheme.lower() in BLOCKED_SCHEMES:
        raise ValueError(f"Blocked URL scheme: {parsed.scheme}")

    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError(f"Only HTTP/HTTPS schemes allowed, got: {parsed.scheme}")

    hostname = parsed.hostname.lower()

    if hostname in BLOCKED_HOSTNAMES:
        raise ValueError(f"Blocked hostname: {hostname}")

    if any(hostname.endswith(suffix) for suffix in BLOCKED_HOSTNAME_SUFFIXES):
        raise ValueError(f"Blocked hostname suffix: {hostname}")

    if _is_private_ip(hostname):
        raise ValueError(f"Blocked private IP address: {hostname}")

    try:
        resolved_ips = await asyncio.to_thread(
            socket.getaddrinfo, hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM
        )
        for _, _, _, _, sockaddr in resolved_ips:
            ip = str(sockaddr[0])
            if _is_private_ip(ip):
                raise ValueError(f"URL resolves to private IP {ip} (hostname: {hostname})")
    except socket.gaierror:
        pass  # DNS resolution failure is not a security issue here
    except ValueError:
        raise  # Re-raise our own ValueError

    return True


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["X-Request-ID"] = request_id

        return response

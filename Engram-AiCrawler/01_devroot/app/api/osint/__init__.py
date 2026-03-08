"""OSINT API sub-package — all routers collected here."""
from app.api.osint.alias import router as alias_router
from app.api.osint.image_basic import router as image_basic_router
from app.api.osint.scan import router as scan_router
from app.api.osint.threat_intel import router as threat_intel_router
from app.api.osint.deep_crawl import router as deep_crawl_router
from app.api.osint.image_intel import router as image_intel_router
from app.api.osint.fraud import router as fraud_router

__all__ = [
    "alias_router",
    "image_basic_router",
    "scan_router",
    "threat_intel_router",
    "deep_crawl_router",
    "image_intel_router",
    "fraud_router",
]

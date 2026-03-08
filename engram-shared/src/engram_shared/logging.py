"""Shared logging configuration for Engram microservices."""

from __future__ import annotations

import logging
import sys
from typing import Optional


def get_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Get a configured logger for the given name.

    Args:
        name: Logger name, typically __name__ of the calling module.
        level: Log level override. Defaults to INFO.

    Returns:
        Configured Logger instance.
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    if level:
        logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    elif not logger.level:
        logger.setLevel(logging.INFO)

    return logger


def configure_root_logging(level: str = "INFO") -> None:
    """Configure root logging for a service entrypoint.

    Args:
        level: Root log level. Defaults to INFO.
    """
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )
    # Quieten noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

"""Disk cache for scraped HTML pages, with 24-hour TTL."""

import hashlib
import json
import os
import time
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
DEFAULT_TTL = 86400  # 24 hours


def _ensure_cache_dir():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_key(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:32]


def get(url: str) -> str | None:
    """Get cached HTML content for a URL, or None if expired/missing."""
    _ensure_cache_dir()
    key = _cache_key(url)
    meta_path = CACHE_DIR / f"{key}.meta.json"
    html_path = CACHE_DIR / f"{key}.html"

    if not meta_path.exists() or not html_path.exists():
        return None

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if time.time() - meta["timestamp"] > DEFAULT_TTL:
            # Expired, clean up
            meta_path.unlink(missing_ok=True)
            html_path.unlink(missing_ok=True)
            return None
    except (json.JSONDecodeError, KeyError):
        return None

    try:
        return html_path.read_text(encoding="utf-8")
    except Exception:
        return None


def set(url: str, html: str):
    """Cache HTML content for a URL."""
    _ensure_cache_dir()
    key = _cache_key(url)
    meta_path = CACHE_DIR / f"{key}.meta.json"
    html_path = CACHE_DIR / f"{key}.html"

    meta_path.write_text(
        json.dumps({"url": url, "timestamp": time.time()}, ensure_ascii=False),
        encoding="utf-8",
    )
    html_path.write_text(html, encoding="utf-8")


def clear():
    """Clear all cached data."""
    if CACHE_DIR.exists():
        for f in CACHE_DIR.iterdir():
            f.unlink(missing_ok=True)


def fetch_cached(url: str, fetcher) -> str:
    """Get HTML for a URL, using cache if available, otherwise fetch and cache."""
    cached = get(url)
    if cached is not None:
        return cached
    html = fetcher(url)
    set(url, html)
    return html

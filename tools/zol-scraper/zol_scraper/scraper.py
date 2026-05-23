import time
import re
import random
from typing import Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .consts import BASE_URL

ENCODING = "gbk"
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

_session: Optional[requests.Session] = None
_session_initialized: bool = False
_last_request_time: float = 0.0
MIN_REQUEST_INTERVAL: float = 1.5
MIN_REQUEST_INTERVAL_JITTER: float = 0.5


def _get_session() -> requests.Session:
    global _session, _session_initialized
    if _session is None:
        _session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=2.0,
            status_forcelist=[500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry)
        _session.mount("https://", adapter)
        _session.headers.update({
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "max-age=0",
            "Connection": "keep-alive",
        })
        _session.cookies.set("z_pro_city", "1", domain=".zol.com.cn")
    if not _session_initialized:
        _init_session()
        _session_initialized = True
    return _session


def _init_session():
    """Visit homepage first to get necessary cookies and bypass anti-scraping."""
    try:
        _session.headers["User-Agent"] = USER_AGENTS[0]
        _session.headers["Referer"] = "https://www.zol.com.cn/"
        _session.get(BASE_URL, timeout=15)
    except Exception:
        pass


def _rate_limit():
    global _last_request_time
    elapsed = time.time() - _last_request_time
    wait = MIN_REQUEST_INTERVAL + random.uniform(0, MIN_REQUEST_INTERVAL_JITTER)
    if elapsed < wait:
        time.sleep(wait - elapsed)
    _last_request_time = time.time()


def _rotate_ua():
    idx = random.randint(0, len(USER_AGENTS) - 1)
    _get_session().headers["User-Agent"] = USER_AGENTS[idx]


def _set_referer(url: str):
    """Set appropriate Referer based on the target URL."""
    if "/param.shtml" in url:
        _get_session().headers["Referer"] = re.sub(
            r"/\d+/\d+/param\.shtml$", "/cell_phone/index{}.shtml".format(
                re.search(r"/(\d+)/param\.shtml", url).group(1) if re.search(r"/(\d+)/param\.shtml", url) else ""
            ), url
        )
    else:
        _get_session().headers["Referer"] = (
            f"{BASE_URL}/cell_phone_advSearch/subcate57_1.html"
        )


def fetch(url: str) -> str:
    """Fetch a URL and return decoded HTML string (GBK).

    Handles ZOL's anti-scraping by maintaining a session with proper cookies
    and Referer headers.
    """
    _rate_limit()
    _rotate_ua()
    _set_referer(url)
    resp = _get_session().get(url, timeout=30)
    resp.raise_for_status()
    raw = resp.content

    # Check for CAPTCHA redirect
    if len(raw) < 500 or b"checking" in raw.lower():
        raise RuntimeError(
            "ZOL anti-scraping triggered. Wait a few minutes and try again."
        )

    # Try GBK first, then fallbacks
    for enc in ("gbk", "gb2312", "gb18030", "utf-8"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace")


def fetch_json(url: str) -> dict:
    """Fetch a URL expecting JSON response."""
    _rate_limit()
    _rotate_ua()
    _set_referer(url)
    resp = _get_session().get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def spec_url_from_id(product_id: int) -> str:
    """Construct the param.shtml URL from a product ID."""
    prefix = (product_id // 1000) + 1
    return f"{BASE_URL}/{prefix}/{product_id}/param.shtml"


def overview_url_from_id(product_id: int) -> str:
    """Construct the overview page URL from a product ID."""
    return f"{BASE_URL}/cell_phone/index{product_id}.shtml"


def extract_product_id_from_url(url: str) -> Optional[int]:
    """Extract product_id from a ZOL URL like /cell_phone/index1494545.shtml."""
    m = re.search(r"index(\d+)\.shtml", url)
    if m:
        return int(m.group(1))
    return None

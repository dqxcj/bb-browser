"""Natural language filter parsing and ZOL URL construction."""

import re
from typing import Optional

from .models import FilterCriterion
from .consts import (
    BRAND_IDS,
    BRAND_ALIASES,
    YEAR_FILTERS,
    SCREEN_SIZE_FILTERS,
    SCREEN_SIZE_RANGES,
    FEATURE_FILTERS,
    RAM_FILTERS,
    ROM_FILTERS,
    BATTERY_FILTERS,
    PRICE_RANGE_FILTERS,
    ALL_PHONES_URL,
    SPEC_FILTER_URL,
    BASE_URL,
    CATEGORY_ID,
)


def parse_criteria(text: str) -> list[FilterCriterion]:
    """Parse a natural language criteria string into structured FilterCriteria.

    Examples:
        "2026年发布的6.3英寸手机"
        -> [FilterCriterion(field="release_year", op="eq", value="2026"),
            FilterCriterion(field="screen_size", op="eq", value="6.3")]

        "华为 512GB 5G"
        -> [FilterCriterion(field="brand", op="eq", value="613"),
            FilterCriterion(field="rom", op="eq", value="512"),
            FilterCriterion(field="5G", op="eq", value="s8237")]
    """
    criteria: list[FilterCriterion] = []

    # 1. Match release year: "2026年", "2026", "2026发布" (only 2020-2029)
    m = re.search(r"(20[2-9]\d)\s*(?:年|发布)?", text)
    if m:
        criteria.append(FilterCriterion(field="release_year", op="eq", value=m.group(1)))

    # 2. Match screen size: "6.3英寸", "6.3寸", "6.3\""
    m = re.search(r"(\d+\.?\d*)\s*(?:英寸|寸|\")", text)
    if m:
        criteria.append(FilterCriterion(field="screen_size", op="eq", value=m.group(1)))

    # 3. Match RAM: "16GB", "12G" (but not ROM when mentioned as storage)
    # Look for RAM patterns: "16GB运行", "16G内存", "16GB+512GB"
    m = re.search(r"(\d+)\s*(?:GB|G)\s*(?:运行|内存|运存|RAM)", text, re.IGNORECASE)
    if not m:
        # Simpler: "16+512" or standalone "16GB" at start/end
        m = re.search(r"(?:^|\s)(\d+)\s*[＋+]\s*\d+", text)
        if m:
            criteria.append(FilterCriterion(field="ram", op="eq", value=m.group(1)))

    # 4. Match ROM/storage: "512GB", "512G", "1TB", "1T"
    m = re.search(r"(\d+)\s*(?:GB|G|TB|T)\s*(?:存储|机身|ROM)", text, re.IGNORECASE)
    if m:
        criteria.append(FilterCriterion(field="rom", op="eq", value=m.group(1)))

    # 5. Match battery: "5000mAh", "8000毫安"
    m = re.search(r"(\d+)\s*(?:mAh|毫安)", text, re.IGNORECASE)
    if m:
        criteria.append(FilterCriterion(field="battery", op="eq", value=m.group(1)))

    # 6. Match camera: "5000万像素", "2亿像素"
    m = re.search(r"(\d+)\s*(?:万|亿)\s*像素", text)
    if m:
        criteria.append(FilterCriterion(field="camera", op="eq", value=m.group(1)))

    # 7. Match charging: "100w", "120W"
    m = re.search(r"(\d+)\s*[wW]\s*(?:快充|充电)?", text)
    if m:
        criteria.append(FilterCriterion(field="charging", op="eq", value=m.group(1)))

    # 8. Match brands
    text_lower = text.lower()
    for alias, brand_cn in BRAND_ALIASES.items():
        if alias in text_lower:
            bid = BRAND_IDS.get(brand_cn)
            if bid:
                criteria.append(FilterCriterion(field="brand", op="eq", value=str(bid)))
                break

    # Also try direct Chinese brand match
    for brand_cn, bid in BRAND_IDS.items():
        if brand_cn in text:
            criteria.append(FilterCriterion(field="brand", op="eq", value=str(bid)))
            break

    # 9. Match feature keywords
    for keyword, filter_id in FEATURE_FILTERS.items():
        if keyword in text:
            criteria.append(FilterCriterion(field=keyword, op="eq", value=filter_id))

    return criteria


def build_listing_url(
    criteria: list[FilterCriterion], page: int = 1
) -> tuple[str, list[FilterCriterion]]:
    """Build the best ZOL listing URL from filter criteria.

    Returns (url, remaining_criteria) where remaining_criteria are filters
    that couldn't be encoded in the URL and need client-side matching.
    """
    remaining = list(criteria)

    # Extract filter IDs
    brand_id: Optional[str] = None
    year_id: Optional[str] = None
    screen_id: Optional[str] = None
    feature_id: Optional[str] = None
    ram_id: Optional[str] = None
    rom_id: Optional[str] = None
    battery_id: Optional[str] = None

    for c in criteria:
        if c.field == "brand" and not brand_id:
            brand_id = c.value
        elif c.field == "release_year" and not year_id:
            year_id = YEAR_FILTERS.get(c.value)
        elif c.field == "screen_size" and not screen_id:
            try:
                size = float(c.value)
                for sid, (lo, hi) in SCREEN_SIZE_RANGES.items():
                    if lo <= size <= hi:
                        screen_id = sid
                        break
            except ValueError:
                pass
        elif c.field == "ram" and not ram_id:
            ram_id = RAM_FILTERS.get(c.value)
        elif c.field == "rom" and not rom_id:
            rom_id = ROM_FILTERS.get(c.value)
        elif c.field in FEATURE_FILTERS and not feature_id:
            feature_id = FEATURE_FILTERS[c.field]

    # Build URL by priority. Only remove the filter actually used from remaining.
    used_field: Optional[str] = None

    if brand_id:
        url = (
            f"{BASE_URL}/cell_phone_index/subcate{CATEGORY_ID}"
            f"_{brand_id}_list_{page}.html"
        )
        used_field = "brand"
    elif year_id:
        url = SPEC_FILTER_URL.format(filter_id=year_id, page=page)
        used_field = "release_year"
    elif screen_id:
        url = SPEC_FILTER_URL.format(filter_id=screen_id, page=page)
        used_field = "screen_size"
    elif ram_id:
        url = SPEC_FILTER_URL.format(filter_id=ram_id, page=page)
        used_field = "ram"
    elif rom_id:
        url = SPEC_FILTER_URL.format(filter_id=rom_id, page=page)
        used_field = "rom"
    elif feature_id:
        url = SPEC_FILTER_URL.format(filter_id=feature_id, page=page)
        used_field = next(
            (c.field for c in criteria if c.field in FEATURE_FILTERS), None
        )
    else:
        url = ALL_PHONES_URL.format(page=page)

    if used_field:
        remaining = [c for c in remaining if c.field != used_field]

    return url, remaining


def get_spec_filter_url(filter_id: str, page: int = 1) -> str:
    """Build a spec filter URL."""
    return SPEC_FILTER_URL.format(filter_id=filter_id, page=page)


def get_brand_listing_url(brand_id: int, page: int = 1) -> str:
    """Build a brand listing URL."""
    return f"{BASE_URL}/cell_phone_index/subcate{CATEGORY_ID}_{brand_id}_list_{page}.html"


def get_all_phones_url(page: int = 1) -> str:
    """Build an all-phones listing URL."""
    return ALL_PHONES_URL.format(page=page)


def match_specs(
    specs: dict[str, str], criteria: list[FilterCriterion]
) -> bool:
    """Check if phone specs match the given criteria (client-side filtering).

    Used for precise matching on criteria that couldn't be encoded in the URL.
    Supports: screen_size, release_year, 5G, NFC, and other feature keywords.
    """
    import re as regex
    for c in criteria:
        if c.field == "screen_size":
            screen = specs.get("屏幕尺寸") or specs.get("主屏尺寸") or ""
            pat = regex.compile(rf"(?:^|\D){regex.escape(c.value)}(?:\s*英寸|\s*寸|\s*\"|$)")
            if not pat.search(screen):
                return False
        elif c.field == "release_year":
            release_date = specs.get("国内发布时间") or specs.get("上市日期") or ""
            if c.value not in release_date:
                return False
        elif c.field in ("5G", "4G"):
            net_type = specs.get("网络类型") or ""
            if c.field not in net_type:
                return False
        elif c.field == "NFC":
            nfc = specs.get("NFC") or ""
            if "支持" not in nfc:
                return False
        elif c.field == "无线充电":
            wireless = specs.get("无线充电") or ""
            if not wireless or "不支持" in wireless:
                return False
        elif c.field == "IP68":
            water = specs.get("三防功能") or ""
            if "IP68" not in water:
                return False
        elif c.field == "折叠屏":
            screen_type = specs.get("屏幕类型") or ""
            if "折叠" not in screen_type:
                return False
        elif c.field in ("快充", "拍照", "游戏"):
            scenes = specs.get("使用场景") or ""
            if c.field not in scenes:
                return False
    return True

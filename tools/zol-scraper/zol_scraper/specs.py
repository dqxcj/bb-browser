"""Parse ZOL param.shtml pages into PhoneSpecs objects."""

import re
from typing import Optional

from bs4 import BeautifulSoup, Tag

from .models import PhoneSpecs
from .consts import SPEC_CATEGORIES


def parse_specs(html: str, product_id: int) -> PhoneSpecs:
    """Parse a ZOL param.shtml page into a PhoneSpecs object.

    Extracts all spec tables organized by category (基本参数, 外形, 硬件, etc.).
    """
    soup = BeautifulSoup(html, "lxml")

    # Extract product name from breadcrumb or page title
    name = _extract_name(soup, product_id)

    specs = PhoneSpecs(
        product_id=product_id,
        name=name,
    )

    # Find all spec tables
    tables = soup.find_all("table")
    current_category = "basic"  # default

    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) == 1:
                # Single-cell row might be a category header
                text = cells[0].get_text(strip=True)
                if text in SPEC_CATEGORIES:
                    current_category = SPEC_CATEGORIES[text]
                continue

            if len(cells) >= 2:
                key = _clean_text(cells[0].get_text())
                value = _clean_text(cells[1].get_text())

                if not key or not value:
                    continue

                # Skip junk rows
                if key in ("电商报价", "问豆包", "") or len(key) < 2:
                    continue

                _set_spec(specs, current_category, key, value)

    # If no tables found, try alternative approach with definition lists or divs
    if not tables:
        _parse_alternative(soup, specs)

    return specs


def _extract_name(soup: BeautifulSoup, product_id: int) -> str:
    """Extract product name from the page."""
    # Try page title first
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
        # Title format: "产品名参数" -> extract product name
        title = re.sub(r"【.*?】", "", title)
        title = title.replace("参数", "").strip()
        if title and len(title) > 2:
            return title

    # Try h1
    h1 = soup.find("h1")
    if h1:
        text = h1.get_text(strip=True)
        text = text.replace("参数", "").strip()
        if text:
            return text

    return f"Product {product_id}"


def _extract_category_header(table: Tag) -> Optional[str]:
    """Check if a table contains a category header (like 基本参数, 外形, etc.)."""
    # Look for th or td with category name
    for cell in table.find_all(["th", "td"]):
        text = cell.get_text(strip=True)
        if text in SPEC_CATEGORIES:
            return text

    # Look for preceding h3/h4 with category name
    prev = table.find_previous_sibling(["h3", "h4", "div"])
    if prev:
        text = prev.get_text(strip=True)
        if text in SPEC_CATEGORIES:
            return text

    return None


def _clean_text(text: str) -> str:
    """Clean up text extracted from HTML cells."""
    # Remove 问豆包 links
    text = re.sub(r"问豆包", "", text)
    # Remove 纠错 text
    text = re.sub(r"纠错", "", text)
    # Remove extra whitespace
    text = re.sub(r"\s+", " ", text)
    # Remove leading/trailing special chars
    text = text.strip(" \t\n\r_｜|")
    return text.strip()


def _set_spec(specs: PhoneSpecs, category: str, key: str, value: str):
    """Set a spec value in the correct category dict."""
    cat_dict = getattr(specs, category, None)
    if cat_dict is not None:
        cat_dict[key] = value


def _parse_alternative(soup: BeautifulSoup, specs: PhoneSpecs):
    """Alternative parsing for pages without standard table structure."""
    # Try to find spec rows in div-based layouts
    current_cat = "basic"
    for element in soup.find_all(["h3", "h4", "div", "dl"]):
        text = element.get_text(strip=True)
        if text in SPEC_CATEGORIES:
            current_cat = SPEC_CATEGORIES.get(text, current_cat)
            continue

        # Try dl > dt/dd pairs
        if element.name == "dl":
            keys = element.find_all("dt")
            values = element.find_all("dd")
            for k, v in zip(keys, values):
                key = _clean_text(k.get_text())
                value = _clean_text(v.get_text())
                if key and value and len(key) >= 2:
                    _set_spec(specs, current_cat, key, value)

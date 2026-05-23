"""Parse ZOL listing pages (product grids) into PhoneSummary objects."""

import re
from typing import Optional

from bs4 import BeautifulSoup, Tag

from .models import PhoneSummary
from .scraper import overview_url_from_id, extract_product_id_from_url


def parse_listing(html: str) -> list[PhoneSummary]:
    """Parse a ZOL listing page HTML into a list of PhoneSummary objects.

    Handles listing pages from:
    - /cell_phone_index/subcate57_0_list_{page}.html (all phones)
    - /cell_phone_index/subcate57_{brandId}_list_{page}.html (by brand)
    - /cell_phone_index/subcate57_list_{filterId}_{page}.html (by filter)
    """
    soup = BeautifulSoup(html, "lxml")
    results: list[PhoneSummary] = []

    # Find all h3 > a elements linking to product detail pages
    product_links = soup.select('h3 a[href*="/cell_phone/index"]')
    seen: set[int] = set()

    for a in product_links:
        href = a.get("href", "")
        product_id = extract_product_id_from_url(href)
        if not product_id or product_id in seen:
            continue
        seen.add(product_id)

        # Product name from the link text
        name = a.get_text(strip=True)

        # Walk up to find the containing li or product card
        container = _find_container(a)

        # Extract price and other info
        price = _extract_price(container)

        summary = PhoneSummary(
            product_id=product_id,
            name=name,
            detail_url=overview_url_from_id(product_id),
            price=price,
        )
        results.append(summary)

    return results


def parse_pagination(html: str) -> tuple[int, int]:
    """Extract (current_page, total_pages) from a listing HTML.

    Returns (1, 1) if pagination cannot be parsed.
    """
    soup = BeautifulSoup(html, "lxml")

    # Look for page-box or pagination elements
    page_box = soup.select_one(".page-box, [class*='page']")
    if page_box:
        # Find current page (active/current page indicator)
        current = page_box.select_one(".current, .active, .on, [class*='cur']")
        if current:
            try:
                cur_page = int(current.get_text(strip=True))
            except ValueError:
                cur_page = 1
        else:
            cur_page = 1

        # Find last page number
        page_links = page_box.find_all("a")
        max_page = cur_page
        for link in page_links:
            try:
                p = int(link.get_text(strip=True))
                if p > max_page:
                    max_page = p
            except ValueError:
                continue
        return cur_page, max_page

    return 1, 1


def _find_container(a: Tag) -> Tag:
    """Walk up from an <a> tag to find the product card container (li or div)."""
    el = a.parent  # h3
    for _ in range(5):
        if el is None:
            break
        if el.name in ("li",):
            return el
        el = el.parent
    return a.parent.parent if a.parent else a  # fallback


def _extract_price(container: Tag) -> Optional[str]:
    """Extract the reference price from a product card container."""
    text = container.get_text(separator="\n")
    m = re.search(r"参考价[：:]\s*(?:￥|¥|&yen;)?\s*(\d+)", text)
    if m:
        return f"¥{m.group(1)}"
    # Try just finding a ￥amount pattern
    m = re.search(r"[￥¥](\d+)", text)
    if m:
        return f"¥{m.group(1)}"
    return None

"""CLI entry point for zol-scraper."""

import json
import sys
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from .scraper import fetch, spec_url_from_id, overview_url_from_id
from .listing import parse_listing
from .specs import parse_specs
from .filters import parse_criteria, build_listing_url, match_specs, get_all_phones_url, get_brand_listing_url
from .cache import fetch_cached
from .consts import BRAND_IDS, BRAND_ALIASES, SORT_PARAMS, BASE_URL, CATEGORY_ID

console = Console()


def _output_json(data, pretty: bool = True):
    """Output data as JSON."""
    indent = 2 if pretty else None

    def convert(obj):
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

    click.echo(json.dumps(data, ensure_ascii=False, indent=indent, default=convert))


def _output_table(phones: list, show_date: bool = False):
    """Output phone list as a Rich table."""
    if not phones:
        console.print("[dim]No results.[/dim]")
        return

    table = Table(title=f"Results ({len(phones)})")
    table.add_column("ID", style="dim")
    if show_date:
        table.add_column("Release Date", style="yellow")
    table.add_column("Name", style="cyan")
    table.add_column("Price", style="green")

    for p in phones:
        pid = str(getattr(p, "product_id", ""))
        name = getattr(p, "name", "")[:65]
        price = getattr(p, "price", "") or "-"
        if show_date:
            date = getattr(p, "release_date", None) or "-"
            table.add_row(pid, date, name, price)
        else:
            table.add_row(pid, name, price)

    console.print(table)


def _fetch_release_date(product_id: int) -> str:
    """Fetch release date from a phone's specs page. Returns '-' on failure."""
    try:
        url = spec_url_from_id(product_id)
        html = fetch_cached(url, fetch)
        specs = parse_specs(html, product_id)
        return specs.basic.get("国内发布时间", "-")
    except Exception:
        return "-"


def _specs_to_table(specs):
    """Output a single phone's specs as a Rich table."""
    table = Table(title=f"{specs.name} (ID: {specs.product_id})")
    table.add_column("Parameter", style="cyan")
    table.add_column("Value", style="green")

    categories = [
        ("基本参数", specs.basic),
        ("外形", specs.dimensions),
        ("硬件", specs.hardware),
        ("屏幕", specs.display),
        ("摄像头", specs.camera),
        ("网络与连接", specs.connectivity),
        ("电池与续航", specs.battery),
        ("功能与服务", specs.features),
        ("手机附件", specs.accessories),
    ]

    for cat_name, cat_dict in categories:
        if cat_dict:
            table.add_section()
            table.add_row(f"[bold]{cat_name}[/bold]", "")
            for k, v in cat_dict.items():
                table.add_row(k, v[:100])

    console.print(table)


def _resolve_brand(query: str) -> Optional[int]:
    """Resolve a brand name to brand ID. Supports Chinese and English names."""
    query_lower = query.lower().strip()

    # Direct Chinese match
    if query in BRAND_IDS:
        return BRAND_IDS[query]

    # English alias match
    if query_lower in BRAND_ALIASES:
        cn = BRAND_ALIASES[query_lower]
        return BRAND_IDS.get(cn)

    # Try partial match
    for alias, cn in BRAND_ALIASES.items():
        if query_lower in alias or alias in query_lower:
            return BRAND_IDS.get(cn)

    for cn, bid in BRAND_IDS.items():
        if query in cn or cn in query:
            return bid

    return None


@click.group()
@click.version_option(version="0.1.0", prog_name="zol-scraper")
def cli():
    """ZOL Scraper - Query phone specs from detail.zol.com.cn."""
    pass


@cli.command("filter")
@click.argument("criteria")
@click.option("--max", "-m", "max_results", type=int, default=30, help="Max results")
@click.option(
    "--output", "-o", "output_fmt", type=click.Choice(["json", "table"]), default="json"
)
@click.option("--fetch-specs/--no-fetch-specs", default=False, help="Fetch full specs for each result (slow)")
def filter_cmd(criteria: str, max_results: int, output_fmt: str, fetch_specs: bool):
    """Filter phones by natural language criteria.

    \b
    Examples:
      zol filter "2026年发布的6.3英寸手机"
      zol filter "华为 512GB 5G"
      zol filter "8GB内存 6.5英寸以上"
    """
    parsed = parse_criteria(criteria)
    if not parsed:
        console.print("[yellow]No filters recognized. Try something like '2026年发布的手机'[/yellow]")
        return

    console.print(f"[dim]Parsed filters: {[(c.field, c.value) for c in parsed]}[/dim]")

    url, remaining = build_listing_url(parsed)
    console.print(f"[dim]Fetching: {url}[/dim]")

    try:
        html = fetch_cached(url, fetch)
    except RuntimeError as e:
        console.print(f"[red]Error: {e}[/red]")
        return

    phones = parse_listing(html)
    results = []

    if remaining:
        console.print(f"[dim]Precise matching needed for: {[(c.field, c.value) for c in remaining]}[/dim]")
        console.print(f"[dim]Fetching full specs for precise filtering (this may take a moment)...[/dim]")

    for phone in phones[:max_results]:
        if remaining:
            try:
                spec_html = fetch_cached(spec_url_from_id(phone.product_id), fetch)
                phone_specs = parse_specs(spec_html, phone.product_id)
                if not match_specs(phone_specs.all_specs, remaining):
                    continue
                if fetch_specs:
                    setattr(phone, 'specs', phone_specs.all_specs)
            except Exception:
                pass
        results.append(phone)

    if output_fmt == "json":
        _output_json(results)
    else:
        _output_table(results)


@cli.command("search")
@click.argument("keyword")
@click.option("--max", "-m", "max_results", type=int, default=30, help="Max results")
@click.option(
    "--output", "-o", "output_fmt", type=click.Choice(["json", "table"]), default="json"
)
def search_cmd(keyword: str, max_results: int, output_fmt: str):
    """Search phones by keyword (matches phone names).

    \b
    Example:
      zol search "小米17 Max"
    """
    # Search across multiple pages
    all_phones = []
    for page in range(1, 5):
        try:
            url = get_all_phones_url(page)
            html = fetch_cached(url, fetch)
            phones = parse_listing(html)
            all_phones.extend(phones)
            if len(phones) < 40:  # Last page
                break
        except Exception:
            break

    # Filter by keyword
    keyword_lower = keyword.lower()
    matched = [p for p in all_phones if keyword_lower in p.name.lower()]

    if output_fmt == "json":
        _output_json(matched[:max_results])
    else:
        _output_table(matched[:max_results])


@cli.command("specs")
@click.argument("product_id", type=int)
@click.option(
    "--output", "-o", "output_fmt", type=click.Choice(["json", "table"]), default="json"
)
def specs_cmd(product_id: int, output_fmt: str):
    """Show detailed specs for a phone by product ID.

    \b
    Example:
      zol specs 2166982
    """
    url = spec_url_from_id(product_id)
    console.print(f"[dim]Fetching: {url}[/dim]")

    try:
        html = fetch_cached(url, fetch)
    except RuntimeError as e:
        console.print(f"[red]Error: {e}[/red]")
        return

    specs = parse_specs(html, product_id)

    if output_fmt == "json":
        _output_json(specs)
    else:
        _specs_to_table(specs)


@cli.command("list")
@click.option("--brand", "-b", default=None, help="Brand name (Chinese or English)")
@click.option("--page", "-p", type=int, default=1, help="Page number")
@click.option("--max", "-m", "max_results", type=int, default=48, help="Max results")
@click.option(
    "--sort", "-s", "sort_by", type=click.Choice(["hot", "time", "price", "rating", "reviews"]),
    default="hot", help="Sort order (default: hot)"
)
@click.option(
    "--output", "-o", "output_fmt", type=click.Choice(["json", "table"]), default="json"
)
def list_cmd(brand: str, page: int, max_results: int, output_fmt: str, sort_by: str):
    """List phones, optionally filtered by brand.

    \b
    Examples:
      zol list
      zol list --brand 华为
      zol list --sort time
      zol list --brand xiaomi --sort price --page 2
    """
    sort_suffix = SORT_PARAMS.get(sort_by, SORT_PARAMS["hot"])

    if brand:
        brand_id = _resolve_brand(brand)
        if not brand_id:
            console.print(f"[red]Unknown brand: {brand}. Available: {', '.join(BRAND_IDS.keys())}[/red]")
            return
        if sort_by == "hot":
            url = get_brand_listing_url(brand_id, page)
        else:
            url = f"{BASE_URL}/cell_phone_index/subcate{CATEGORY_ID}_{brand_id}_list_{page}_{sort_suffix}_{page}.html"
    else:
        if sort_by == "hot":
            url = get_all_phones_url(page)
        else:
            url = f"{BASE_URL}/cell_phone_index/subcate{CATEGORY_ID}_0_list_{page}_{sort_suffix}_{page}.html"

    console.print(f"[dim]Fetching: {url}[/dim]")

    try:
        html = fetch_cached(url, fetch)
    except RuntimeError as e:
        console.print(f"[red]Error: {e}[/red]")
        return

    phones = parse_listing(html)[:max_results]

    if output_fmt == "json":
        _output_json(phones)
    else:
        _output_table(phones)


@cli.command("latest")
@click.option("--max", "-m", "max_results", type=int, default=20, help="Max results")
@click.option(
    "--output", "-o", "output_fmt", type=click.Choice(["json", "table"]), default="table"
)
@click.option(
    "--dates/--no-dates", default=True, help="Fetch release dates (default: on)"
)
def latest_cmd(max_results: int, output_fmt: str, dates: bool):
    """Show the latest/recently released phones with release dates.

    \b
    Shortcut for: zol list --sort time
    Example:
      zol latest --max 10
      zol latest --max 10 --no-dates  (faster, no spec fetching)
    """
    sort_suffix = SORT_PARAMS["time"]
    url = f"{BASE_URL}/cell_phone_index/subcate{CATEGORY_ID}_0_list_1_{sort_suffix}_1.html"
    console.print(f"[dim]Fetching: {url}[/dim]")

    try:
        html = fetch_cached(url, fetch)
    except RuntimeError as e:
        console.print(f"[red]Error: {e}[/red]")
        return

    phones = parse_listing(html)[:max_results]

    if dates:
        console.print(f"[dim]Fetching release dates for {len(phones)} phones...[/dim]")
        for phone in phones:
            phone.release_date = _fetch_release_date(phone.product_id)  # type: ignore

    if output_fmt == "json":
        _output_json([{
            "product_id": p.product_id,
            "name": p.name,
            "price": p.price,
            "release_date": getattr(p, "release_date", None),
            "detail_url": p.detail_url,
        } for p in phones])
    else:
        _output_table(phones, show_date=dates)


if __name__ == "__main__":
    cli()

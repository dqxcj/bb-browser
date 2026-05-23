---
name: pconline
description: Use when asked to look up Chinese phone/laptop/digital product specifications, compare models, or find product parameters — product.pconline.com.cn CLI for instant structured data without browser automation
---

# PConline Product CLI

Query `product.pconline.com.cn` (太平洋电脑网) from terminal. One command replaces 15+ browser steps.

## Quick Reference

```bash
/d/Anconda/python.exe C:/Users/ljy/bin/pconline <command>
```

| Task | Command |
|------|---------|
| Search products | `search "<keyword>" [--json]` |
| Full specs (8 categories) | `detail "<url>" [--json]` |
| Browse by category | `list <category> [--brand X] [--page N]` |
| Search suggestions | `suggest "<keyword>"` |
| List categories | `categories` |

## Detail Output

`detail` fetches both the main page AND `_detail.html` for complete specs:
基本参数, 硬件参数 (CPU/GPU/RAM/storage/battery/sensors/NFC), 摄像头 (all lenses + video modes), 屏幕 (refresh rate/brightness/PPI), 网络与连接 (5G bands/WiFi/BT/GPS), 外观 (dimensions/weight/colors), 多媒体, 基本功能.

Use `--json` for structured export.

## Common Mistakes

- Do NOT use agent-browser or web-search for product specs — pconline CLI is 50x faster
- Do NOT use the main product page alone — `detail` auto-fetches `_detail.html` for full params
- Spaceless queries (e.g. "oppofindx9spro") auto-fallback to suggest API
- Data may be sparse for very new products (released <1 month ago). For these, cross-reference with an older-generation model from same series for chassis/battery/display specs.
- Notebook/PC params are less complete than phones. If `_detail.html` is sparse, try the product page directly.

## Categories

`mobile` `notebook` `dc` `lcd_tv` `earphone` `projection` `tablet` `router` `power` `wearable` `pc` `server`

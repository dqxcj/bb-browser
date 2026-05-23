"""Constants and URL templates for ZOL scraping."""

BASE_URL = "https://detail.zol.com.cn"

CATEGORY_ID = 57  # 手机

# --- URL templates ---
ADV_SEARCH_URL = f"{BASE_URL}/cell_phone_advSearch/subcate{CATEGORY_ID}_1.html"
LISTING_URL = f"{BASE_URL}/cell_phone_index/subcate{CATEGORY_ID}_{{brand_id}}_list_{{page}}.html"
SPEC_FILTER_URL = (
    f"{BASE_URL}/cell_phone_index/subcate{CATEGORY_ID}_list_{{filter_id}}_{{page}}.html"
)
ALL_PHONES_URL = f"{BASE_URL}/cell_phone_index/subcate{CATEGORY_ID}_0_list_{{page}}.html"

# --- Brand ID mapping ---
BRAND_IDS: dict[str, int] = {
    "华为": 613,
    "vivo": 1795,
    "OPPO": 1673,
    "苹果": 544,
    "三星": 98,
    "荣耀": 50840,
    "iQOO": 55075,
    "小米": 34645,
    "一加": 35579,
    "魅族": 1434,
    "真我": 55535,
    "努比亚": 35005,
    "红米": 55731,
    "摩托罗拉": 295,
    "Moto": 295,
    "中兴": 642,
    "联想": 101,
    "索尼": 105,
    "黑鲨": 55358,
    "ROG": 55567,
    "Nothing": 58376,
    "HTC": 399,
    "LG": 104,
    "谷歌": 53449,
    "天语": 150,
    "飞利浦": 132,
    "诺基亚": 193,
    "HMD": 57581,
    "WIKO": 56800,
    "纽曼": 171,
    "AGM": 55899,
    "Unihertz": 57631,
    "VERTU": 568,
    "8848": 57372,
}

# --- Release year filter IDs (s-prefix = spec filter) ---
YEAR_FILTERS: dict[str, str] = {
    "2026": "s11112",
    "2025": "s11066",
    "2024": "s11042",
    "2023": "s10086",
    "2022": "s9277",
    "2021": "s8975",
    "2020": "s8379",
    "2019": "s6508",
}

# --- Screen size range filter IDs ---
SCREEN_SIZE_FILTERS: dict[str, str] = {
    "7.0及以上": "s9627",
    "6.5-6.9": "s5371",
    "6.0-6.4": "s7947",
    "5.6-5.9": "s10215",
    "5.5及以下": "s7545",
}

# Screen size ranges -> precise bucket mapping
SCREEN_SIZE_RANGES: dict[str, tuple[float, float]] = {
    "s9627": (7.0, 20.0),
    "s5371": (6.5, 6.99),
    "s7947": (6.0, 6.49),
    "s10215": (5.6, 5.99),
    "s7545": (0.0, 5.59),
}

# --- Price range filters ---
PRICE_RANGE_FILTERS: dict[str, str] = {
    "1000以下": "p39840",
    "1000-1999": "s9983",
    "2000-2999": "s4720",
    "3000-3999": "s6994",
    "4000-4999": "s9887",
    "5000-5999": "s10932",
    "6000-6999": "s10933",
    "7000-7999": "s10934",
    "8000以上": "s10935",
}

# --- Feature keyword filters ---
FEATURE_FILTERS: dict[str, str] = {
    "5G": "s8237",
    "4G": "s528",
    "折叠屏": "s9628",
    "直面屏": "s9688",
    "曲面屏": "s9223",
    "快充": "s6523",
    "三防": "s10214",
    "拍照": "s10078",
    "游戏": "s10079",
    "长续航": "s10213",
    "无线充电": "s9241",
    "NFC": "s6225",
    "防水": "s7732",
    "高刷": "s10399",
    "IP68": "s9463",
    "IP67": "s9464",
    "双扬声器": "s9220",
    "红外遥控": "s9362",
    "屏幕指纹": "s8041",
    "侧面指纹": "s8044",
    "光学防抖": "s10076",
    "电子防抖": "s10077",
    "USB-C": "s6312",
    "3.5mm耳机孔": "s7360",
    "双卡": "s7477",
    "北斗导航": "s5745",
    "GPS": "s2034",
    "WiFi7": "s10221",
    "WiFi6": "s8400",
    "AMOLED": "s9715",
    "OLED": "s7379",
    "LCD": "s8359",
    "120Hz": "s8449",
    "144Hz": "s8448",
    "165Hz": "s9484",
    "2K": "s5528",
    "1080P": "s4328",
    "玻璃后壳": "s10141",
    "素皮后壳": "s10143",
    "支持扩展": "s4339",
    "LPDDR5X": "s10082",
    "LPDDR5": "s9278",
    "UFS4.0": "s10081",
    "UFS3.1": "s9280",
}

# --- RAM capacity filter IDs ---
RAM_FILTERS: dict[str, str] = {
    "24": "s10935", "18": "s9048", "16": "s8462",
    "12": "s8051", "10": "s7998", "8": "s7318",
    "6": "s6509",
}

# --- ROM/storage filter IDs ---
ROM_FILTERS: dict[str, str] = {
    "2048": "s11083", "2TB": "s11083",
    "1024": "s7832", "1TB": "s7832",
    "512": "s7831",
    "256": "s7075",
    "128": "s6193",
    "64": "s4150",
}

# --- Battery capacity filter IDs ---
BATTERY_FILTERS: dict[str, str] = {
    "8000以上": "s11114",
    "6000-8000": "s10126",
    "5500-6000": "s11122",
    "5000-5500": "s10127",
    "4500-5000": "s7372",
    "4000-4500": "s9466",
    "4000以下": "s2991",
}

# --- Spec category names (Chinese -> English key) ---
SPEC_CATEGORIES: dict[str, str] = {
    "基本参数": "basic",
    "外形": "dimensions",
    "硬件": "hardware",
    "屏幕": "display",
    "摄像头": "camera",
    "网络与连接": "connectivity",
    "电池与续航": "battery",
    "功能与服务": "features",
    "手机附件": "accessories",
}

# --- Brand aliases ---
BRAND_ALIASES: dict[str, str] = {
    "huawei": "华为",
    "xiaomi": "小米",
    "apple": "苹果",
    "samsung": "三星",
    "honor": "荣耀",
    "oneplus": "一加",
    "meizu": "魅族",
    "realme": "真我",
    "nubia": "努比亚",
    "redmi": "红米",
    "lenovo": "联想",
    "sony": "索尼",
    "nokia": "诺基亚",
    "zte": "中兴",
    "moto": "摩托罗拉",
    "motorola": "摩托罗拉",
    "google": "谷歌",
    "nothing": "Nothing",
    "htc": "HTC",
    "rog": "ROG",
    "blackshark": "黑鲨",
    "philips": "飞利浦",
    "vertu": "VERTU",
    "agm": "AGM",
    "unihertz": "Unihertz",
    "hmd": "HMD",
    "wiko": "WIKO",
    "tianyu": "天语",
    "newman": "纽曼",
}

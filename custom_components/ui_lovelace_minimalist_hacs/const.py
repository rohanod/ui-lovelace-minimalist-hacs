from __future__ import annotations

import json
from pathlib import Path
from typing import Final

DOMAIN: Final = "ui_lovelace_minimalist_hacs"
NAME: Final = "UI Lovelace Minimalist HACS"
GENERATED_PATH: Final = "generated"
RESOURCE_ROOT: Final = f"/{DOMAIN}"
RESOURCE_FILENAME: Final = "ui-lovelace-minimalist-hacs.js"
RESOURCE_URL: Final = f"{RESOURCE_ROOT}/{RESOURCE_FILENAME}"
WWW_RESOURCE_ROOT: Final = f"/local/community/{DOMAIN}"
WWW_RESOURCE_URL: Final = f"{WWW_RESOURCE_ROOT}/{RESOURCE_FILENAME}"

_MANIFEST_PATH = Path(__file__).parent / "manifest.json"
with _MANIFEST_PATH.open(encoding="utf-8") as manifest_file:
    VERSION: Final = json.load(manifest_file).get("version", "0.0.0")

VERSIONED_RESOURCE_FILENAME: Final = f"ui-lovelace-minimalist-hacs-v{VERSION}.js"
VERSIONED_WWW_RESOURCE_URL: Final = f"{WWW_RESOURCE_ROOT}/{VERSIONED_RESOURCE_FILENAME}"
VERSIONED_RESOURCE_URL: Final = VERSIONED_WWW_RESOURCE_URL

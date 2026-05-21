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

_MANIFEST_PATH = Path(__file__).parent / "manifest.json"
with _MANIFEST_PATH.open(encoding="utf-8") as manifest_file:
    VERSION: Final = json.load(manifest_file).get("version", "0.0.0")

VERSIONED_RESOURCE_URL: Final = f"{RESOURCE_URL}?v={VERSION}"

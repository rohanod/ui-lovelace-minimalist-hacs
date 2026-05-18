"""UI Lovelace Minimalist HACS helper integration."""

from __future__ import annotations

from pathlib import Path
import shutil

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Install generated Minimalist assets into www for UI dashboard use."""
    source = Path(__file__).parent / "generated"
    target = Path(hass.config.path("www", "community", DOMAIN))

    def copy_assets() -> None:
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target)

    await hass.async_add_executor_job(copy_assets)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {"asset_path": str(target)}
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the helper integration."""
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True

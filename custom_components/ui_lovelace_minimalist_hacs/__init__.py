"""UI Lovelace Minimalist HACS helper integration."""

from __future__ import annotations

from collections.abc import Mapping
from contextlib import suppress
import logging
from pathlib import Path
from typing import Any

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.helpers.event import async_call_later

from .const import DOMAIN, RESOURCE_ROOT, RESOURCE_URL, VERSIONED_RESOURCE_URL

_LOGGER = logging.getLogger(__name__)


def _resource_path(url: str) -> str:
    """Return the resource URL without query parameters."""
    return url.split("?", 1)[0]


async def _async_register_static_path(hass: HomeAssistant) -> None:
    """Serve the bundled frontend module from the integration directory."""
    source = Path(__file__).parent / "generated"
    with suppress(RuntimeError):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(RESOURCE_ROOT, str(source), True)]
        )


async def _async_register_lovelace_resource(hass: HomeAssistant) -> None:
    """Create or update the Lovelace resource in storage mode."""
    lovelace = hass.data.get("lovelace")
    if lovelace is None or getattr(lovelace, "mode", None) != "storage":
        return

    resources = getattr(lovelace, "resources", None)
    if resources is None:
        return

    if not getattr(resources, "loaded", False):
        async def _retry_resource_registration(_now: Any) -> None:
            await _async_register_lovelace_resource(hass)

        async_call_later(hass, 5, _retry_resource_registration)
        return

    existing = [
        item
        for item in resources.async_items()
        if _resource_path(item.get("url", "")) == RESOURCE_URL
    ]
    resource_config = {"res_type": "module", "url": VERSIONED_RESOURCE_URL}

    if existing:
        resource = existing[0]
        if resource.get("url") != VERSIONED_RESOURCE_URL or resource.get("res_type") != "module":
            await resources.async_update_item(resource["id"], resource_config)
            _LOGGER.info("Updated Lovelace resource %s", VERSIONED_RESOURCE_URL)
        return

    await resources.async_create_item(resource_config)
    _LOGGER.info("Registered Lovelace resource %s", VERSIONED_RESOURCE_URL)


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Register the static file route and Lovelace resource."""
    await _async_register_static_path(hass)
    await _async_register_lovelace_resource(hass)


async def async_setup(hass: HomeAssistant, config: Mapping[str, Any]) -> bool:
    """Set up frontend registration once for the integration."""

    async def _setup_frontend(_event: Any = None) -> None:
        await _async_register_frontend(hass)

    if hass.state == CoreState.running:
        await _setup_frontend()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _setup_frontend)

    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up the helper config entry."""
    await _async_register_frontend(hass)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {
        "resource_url": VERSIONED_RESOURCE_URL,
    }
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the helper integration."""
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True

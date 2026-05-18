"""Config flow for UI Lovelace Minimalist HACS."""

from __future__ import annotations

from homeassistant import config_entries

from .const import DOMAIN, NAME

class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Create the single helper entry from the UI."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_create_entry(title=NAME, data={})

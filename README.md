# UI Lovelace Minimalist HACS

This repository is generated from [`UI-Lovelace-Minimalist/UI`](https://github.com/UI-Lovelace-Minimalist/UI).

It packages the Minimalist button-card templates and community card YAML so they can be installed as a HACS custom integration and used from Home Assistant dashboards that are edited through the UI raw configuration editor.

## What This Provides

- A HACS-compatible Home Assistant integration: `custom_components/ui_lovelace_minimalist_hacs`.
- Generated template bundles in `dist/`.
- One YAML snippet per usable card/chip template in `dist/example-card-snippets/`.
- A Bun sync script that can regenerate this repo from upstream or from a local checkout.

## Install With HACS

1. Add this repository to HACS as a custom repository with category `Integration`.
2. Install `UI Lovelace Minimalist HACS`.
3. Restart Home Assistant.
4. Add the integration from Settings -> Devices & services.
5. Open any dashboard, use the raw configuration editor, and paste the contents of `dist/ui-raw-dashboard-snippet.yaml` at the dashboard root.
6. Add cards from `dist/example-card-snippets/` and edit them in the UI raw editor.

The generated cards assume you have the runtime dependencies installed, especially `custom:button-card` and any optional cards used by a given template.

## Updating From Upstream

From this repository:

```bash
bun run sync
```

For local development against a sibling checkout:

```bash
bun run sync:local
```

The sync process clones or reads the source repository, extracts templates and community cards, writes the generated integration payload, and refreshes the distributable snippets.

## Output Layout

- `dist/button-card-templates.yaml`: all core and community template definitions.
- `dist/ui-raw-dashboard-snippet.yaml`: paste this into a UI-managed dashboard raw config.
- `dist/template-index.json`: generated metadata for available templates.
- `dist/example-card-snippets/*.yaml`: starter cards you can paste into dashboards.
- `custom_components/ui_lovelace_minimalist_hacs/generated/`: same generated payload bundled inside the HACS integration.


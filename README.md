# UI Lovelace Minimalist HACS

This repository is generated from [`UI-Lovelace-Minimalist/UI`](https://github.com/UI-Lovelace-Minimalist/UI).

It packages the Minimalist button-card templates and community card YAML so they can be installed as a HACS custom integration and used from Home Assistant dashboards that are edited through the UI raw configuration editor.

Use the HACS `Integration` category for the full helper integration. The repository also includes a generated dashboard plugin entrypoint so HACS can validate it as `Dashboard`/`Plugin`, but it is not a HACS `Template` repository.

## What This Provides

- A HACS-compatible Home Assistant integration: `custom_components/ui_lovelace_minimalist_hacs`.
- A HACS-compatible dashboard plugin entrypoint: `dist/ui-lovelace-minimalist-hacs.js`.
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

Do not add this repository as HACS category `Template`; HACS templates are `.jinja` files and this project distributes Lovelace/button-card YAML templates.

## Dashboard Helper Card

You can add the helper card directly to a dashboard:

```yaml
type: custom:ui-lovelace-minimalist-hacs
```

Template list mode:

```yaml
type: custom:ui-lovelace-minimalist-hacs
title: Minimalist templates
mode: templates
templates:
  - card_light
  - card_room
  - card_person
  - card_media_player
  - card_power_outlet
  - card_weather
  - chip_icon_state
  - chip_temperature
```

Example mode:

```yaml
type: custom:ui-lovelace-minimalist-hacs
title: Minimalist examples
mode: examples
examples:
  - title: Dimmable light
    yaml: |
      type: custom:button-card
      template: card_light
      entity: light.living_room
      variables:
        ulm_card_light_enable_slider: true
```

More examples are generated in `dist/dashboard-card-examples.yaml`.

## Using Button-Card Templates

Cards such as `battery_info`, `card_light`, and `card_room` are not standalone custom cards. They are `custom:button-card` templates and must be present under the dashboard root `button_card_templates:` key before any card can use them.

If you see an error like this:

```text
Button-card template 'battery_info' is missing!
```

paste the generated template bundle into the dashboard raw configuration first:

```yaml
button_card_templates:
  # paste the contents of dist/button-card-templates.yaml here, indented two spaces
```

Or paste the ready-made generated root block from:

```text
dist/ui-raw-dashboard-snippet.yaml
```

After that, a template card can be added under a view's `cards:` list:

```yaml
type: custom:button-card
template: battery_info
entity: sensor.phone_battery
variables: {}
```

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
- `dist/ui-lovelace-minimalist-hacs.js`: HACS dashboard plugin entrypoint.
- `dist/dashboard-card-examples.yaml`: pasteable examples for `type: custom:ui-lovelace-minimalist-hacs`.
- `dist/ui-raw-dashboard-snippet.yaml`: paste this into a UI-managed dashboard raw config.
- `dist/template-index.json`: generated metadata for available templates.
- `dist/example-card-snippets/*.yaml`: starter cards you can paste into dashboards.
- `custom_components/ui_lovelace_minimalist_hacs/generated/`: same generated payload bundled inside the HACS integration.

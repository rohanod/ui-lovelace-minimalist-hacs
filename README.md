# UI Lovelace Minimalist HACS

Generated from [`UI-Lovelace-Minimalist/UI`](https://github.com/UI-Lovelace-Minimalist/UI).

This repository exposes one dashboard card:

```yaml
type: custom:ui-lovelace-minimalist-hacs
template: card_light
entity: light.living_room
variables:
  ulm_card_light_enable_slider: true
```

The wrapper card resolves bundled UI Lovelace Minimalist templates internally, then renders a `custom:button-card`. You do not paste template bundles into dashboards.

## Install

1. Add this repository to HACS as a `Dashboard` repository.
2. Install `UI Lovelace Minimalist HACS`.
3. HACS will add the dashboard resource automatically.
4. Use `type: custom:ui-lovelace-minimalist-hacs` in any dashboard.

The HACS dashboard resource should be:

```text
/hacsfiles/ui-lovelace-minimalist-hacs/ui-lovelace-minimalist-hacs.js
```

HACS may append a cache tag query string to that URL. That is expected.

You still need `custom:button-card` installed, because this wrapper renders button-card after resolving the bundled Minimalist templates.

Some community templates use additional custom cards. For example, `custom_card_mpse_printer` uses `custom:bar-card`, so install `bar-card` from HACS before using that template. The generated `dist/template-index.json` includes a `dependencies` array for each template.

## Examples

Light:

```yaml
type: custom:ui-lovelace-minimalist-hacs
template: card_light
entity: light.living_room
variables:
  ulm_card_light_enable_slider: true
```

Room:

```yaml
type: custom:ui-lovelace-minimalist-hacs
template: card_room
name: Living Room
entity: light.living_room
variables:
  label_use_brightness: true
```

Community template:

```yaml
type: custom:ui-lovelace-minimalist-hacs
template: battery_info
entity: sensor.phone_battery
variables: {}
```

More generated examples are in `dist/wrapper-card-examples.yaml`.

## YAML Builder

Run the local static builder to generate paste-ready standalone card YAML:

```bash
bun run serve:builder
```

Open:

```text
http://localhost:4173/site/
```

The builder loads `dist/template-index.json` and `dist/template-data.json`, lets you choose one card template, fill an entity and variables, and copy YAML for Home Assistant's manual card editor.

The generated YAML is `type: custom:button-card` with the selected Minimalist template resolved inline. It does not require this wrapper card or the full UI Lovelace Minimalist theme to be installed. It still requires `button-card`, plus any functional nested custom cards used by the selected template, such as `bar-card` for printer/bar templates.

## Updating From Upstream

```bash
bun run sync
```

For local development against a sibling checkout:

```bash
bun run sync:local
```

## Generated Files

- `dist/ui-lovelace-minimalist-hacs.js`: the HACS dashboard card resource with bundled templates.
- `dist/template-index.json`: generated metadata for available templates.
- `dist/wrapper-card-examples.yaml`: pasteable wrapper-card examples.
- `dist/example-card-snippets/*.yaml`: one wrapper-card snippet per direct-use template.

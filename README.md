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

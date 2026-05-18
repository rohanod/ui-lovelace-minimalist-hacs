const TEMPLATE_COUNT = 396;

const DEFAULT_TEMPLATES = [
  "card_light",
  "card_room",
  "card_person",
  "card_media_player",
  "card_power_outlet",
  "card_weather",
  "chip_icon_state",
  "chip_temperature"
];

const DEFAULT_EXAMPLES = [
  {
    title: "Light",
    yaml: "type: custom:button-card\ntemplate: card_light\nentity: light.living_room\nvariables:\n  ulm_card_light_enable_slider: true"
  },
  {
    title: "Room",
    yaml: "type: custom:button-card\ntemplate: card_room\nname: Living Room\nentity: light.living_room\nvariables:\n  label_use_brightness: true"
  },
  {
    title: "Person",
    yaml: "type: custom:button-card\ntemplate: card_person\nentity: person.rohan\nvariables: {}"
  }
];

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

class UiLovelaceMinimalistHacs extends HTMLElement {
  setConfig(config) {
    this.config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  renderTemplateList(templates) {
    return [
      "<div class=\"template-grid\">",
      ...templates.map((template) => "<code>" + escapeHtml(template) + "</code>"),
      "</div>"
    ].join("");
  }

  renderExamples(examples) {
    return examples.map((example) => [
      "<section class=\"example\">",
      "<h2>" + escapeHtml(example.title || "Example") + "</h2>",
      "<pre><code>" + escapeHtml(example.yaml || "") + "</code></pre>",
      "</section>"
    ].join("")).join("");
  }

  render() {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    const config = this.config || {};
    const mode = config.mode || "summary";
    const templates = Array.isArray(config.templates) && config.templates.length ? config.templates : DEFAULT_TEMPLATES;
    const examples = Array.isArray(config.examples) && config.examples.length ? config.examples : DEFAULT_EXAMPLES;
    const title = config.title || "UI Lovelace Minimalist HACS";
    const description = config.description || TEMPLATE_COUNT + " generated button-card templates are installed.";
    const body = mode === "templates"
      ? this.renderTemplateList(templates)
      : mode === "examples"
        ? this.renderExamples(examples)
        : [
            "<p>" + escapeHtml(description) + "</p>",
            this.renderTemplateList(templates.slice(0, 8))
          ].join("");

    root.innerHTML = [
      "<ha-card>",
      "<div class=\"content\">",
      "<h1>" + escapeHtml(title) + "</h1>",
      body,
      "</div>",
      "</ha-card>",
      "<style>",
      "ha-card { padding: 16px; }",
      ".content { display: grid; gap: 12px; }",
      "h1 { font-size: 18px; margin: 0; }",
      "h2 { font-size: 14px; margin: 0; }",
      "p { margin: 0; color: var(--secondary-text-color); }",
      ".template-grid { display: flex; flex-wrap: wrap; gap: 8px; }",
      "code { background: var(--code-editor-background-color, rgba(127,127,127,0.14)); border-radius: 6px; padding: 3px 6px; }",
      "pre { overflow-x: auto; margin: 0; padding: 10px; background: var(--code-editor-background-color, rgba(127,127,127,0.14)); border-radius: 8px; }",
      "pre code { background: transparent; padding: 0; white-space: pre; }",
      ".example { display: grid; gap: 6px; }",
      "</style>"
    ].join("");
  }

  getCardSize() {
    const mode = this.config?.mode || "summary";
    return mode === "examples" ? 5 : 2;
  }
}

if (!customElements.get("ui-lovelace-minimalist-hacs")) {
  customElements.define("ui-lovelace-minimalist-hacs", UiLovelaceMinimalistHacs);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ui-lovelace-minimalist-hacs",
  name: "UI Lovelace Minimalist HACS",
  description: "Shows installed Minimalist template examples and quick reference."
});

console.info("UI Lovelace Minimalist HACS loaded");

class UiLovelaceMinimalistHacs extends HTMLElement {
  setConfig(config) {
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  render() {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <ha-card>
        <div class="content">
          <h1>UI Lovelace Minimalist HACS</h1>
          <p>396 generated button-card templates are bundled with this repository.</p>
          <p>Use the YAML snippets from <code>dist/example-card-snippets</code> or paste <code>dist/ui-raw-dashboard-snippet.yaml</code> into a dashboard raw editor.</p>
        </div>
      </ha-card>
      <style>
        ha-card { padding: 16px; }
        .content { display: grid; gap: 8px; }
        h1 { font-size: 18px; margin: 0; }
        p { margin: 0; }
      </style>
    `;
  }

  getCardSize() {
    return 2;
  }
}

if (!customElements.get("ui-lovelace-minimalist-hacs")) {
  customElements.define("ui-lovelace-minimalist-hacs", UiLovelaceMinimalistHacs);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ui-lovelace-minimalist-hacs",
  name: "UI Lovelace Minimalist HACS",
  description: "Helper card for the generated UI Lovelace Minimalist template bundle."
});

console.info("UI Lovelace Minimalist HACS loaded");

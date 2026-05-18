import { mkdtemp, readdir, readFile, rm, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = join(import.meta.dir, "..");
const defaultRepo = "https://github.com/UI-Lovelace-Minimalist/UI.git";
const integrationDomain = "ui_lovelace_minimalist_hacs";
const integrationDir = join(repoRoot, "custom_components", integrationDomain);
const generatedDir = join(integrationDir, "generated");
const distDir = join(repoRoot, "dist");
const pluginFileName = "ui-lovelace-minimalist-hacs.js";
const dashboardExamplesFileName = "dashboard-card-examples.yaml";

type TemplateEntry = {
  name: string;
  source: string;
  category: string;
  directUse: boolean;
};

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = Bun.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = Bun.argv.indexOf(name);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

async function run(command: string[], cwd: string) {
  const proc = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${command.join(" ")} failed with exit code ${code}`);
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    if (entry.name === ".DS_Store" || entry.name === ".git") return [];
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    if (entry.isFile()) return [path];
    return [];
  }));
  return files.flat().sort();
}

async function copyTree(source: string, destination: string) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const file of await listFiles(source)) {
    const target = join(destination, relative(source, file));
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
  }
}

function stripDocumentMarker(content: string): string {
  return content.replace(/^---\s*\r?\n/, "").trimEnd();
}

function topLevelKeys(content: string): string[] {
  return [...content.matchAll(/^([A-Za-z0-9_][A-Za-z0-9_-]*):\s*(?:#.*)?$/gm)].map((match) => match[1]);
}

function categoryFor(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.includes("/custom_cards/")) return "community";
  if (normalized.includes("/card_templates/cards/")) return "card";
  if (normalized.includes("/card_templates/chips/")) return "chip";
  if (normalized.includes("/card_templates/title/")) return "title";
  if (normalized.includes("/card_templates/2-line_cards/")) return "card";
  if (normalized.includes("/popup_templates/")) return "popup";
  if (normalized.includes("/actions/")) return "action";
  return "support";
}

function isDirectUse(category: string): boolean {
  return ["card", "chip", "title", "community"].includes(category);
}

function exampleEntityFor(templateName: string): string {
  if (templateName.includes("light")) return "light.example";
  if (templateName.includes("weather")) return "weather.example";
  if (templateName.includes("person")) return "person.example";
  if (templateName.includes("cover")) return "cover.example";
  if (templateName.includes("fan")) return "fan.example";
  if (templateName.includes("vacuum")) return "vacuum.example";
  if (templateName.includes("media")) return "media_player.example";
  if (templateName.includes("battery")) return "sensor.example_battery";
  if (templateName.includes("temperature")) return "sensor.example_temperature";
  if (templateName.includes("power")) return "sensor.example_power";
  if (templateName.includes("binary")) return "binary_sensor.example";
  if (templateName.includes("script")) return "script.example";
  return "sensor.example";
}

function snippetFor(templateName: string): string {
  const entity = exampleEntityFor(templateName);
  return [
    "type: custom:button-card",
    `template: ${templateName}`,
    `entity: ${entity}`,
    "variables: {}",
    "",
  ].join("\n");
}

async function writeGeneratedIntegration(sourceRepo: string, entries: TemplateEntry[]) {
  await mkdir(integrationDir, { recursive: true });
  await writeFile(join(integrationDir, "manifest.json"), `${JSON.stringify({
    domain: integrationDomain,
    name: "UI Lovelace Minimalist HACS",
    codeowners: [],
    config_flow: true,
    dependencies: ["lovelace", "frontend"],
    documentation: "https://github.com/rohan/ui-lovelace-minimalist-hacs",
    iot_class: "calculated",
    issue_tracker: "https://github.com/rohan/ui-lovelace-minimalist-hacs/issues",
    version: "1.0.0",
  }, null, 2)}\n`);
  await writeFile(join(integrationDir, "const.py"), [
    `DOMAIN = "${integrationDomain}"`,
    `NAME = "UI Lovelace Minimalist HACS"`,
    `GENERATED_PATH = "generated"`,
    "",
  ].join("\n"));
  await writeFile(join(integrationDir, "__init__.py"), [
    "\"\"\"UI Lovelace Minimalist HACS helper integration.\"\"\"",
    "",
    "from __future__ import annotations",
    "",
    "from pathlib import Path",
    "import shutil",
    "",
    "from homeassistant.config_entries import ConfigEntry",
    "from homeassistant.core import HomeAssistant",
    "",
    "from .const import DOMAIN",
    "",
    "async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:",
    "    \"\"\"Install generated Minimalist assets into www for UI dashboard use.\"\"\"",
    "    source = Path(__file__).parent / \"generated\"",
    "    target = Path(hass.config.path(\"www\", \"community\", DOMAIN))",
    "",
    "    def copy_assets() -> None:",
    "        if target.exists():",
    "            shutil.rmtree(target)",
    "        shutil.copytree(source, target)",
    "",
    "    await hass.async_add_executor_job(copy_assets)",
    "    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {\"asset_path\": str(target)}",
    "    return True",
    "",
    "async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:",
    "    \"\"\"Unload the helper integration.\"\"\"",
    "    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)",
    "    return True",
    "",
  ].join("\n"));
  await writeFile(join(integrationDir, "config_flow.py"), [
    "\"\"\"Config flow for UI Lovelace Minimalist HACS.\"\"\"",
    "",
    "from __future__ import annotations",
    "",
    "from homeassistant import config_entries",
    "",
    "from .const import DOMAIN, NAME",
    "",
    "class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):",
    "    \"\"\"Handle a config flow.\"\"\"",
    "",
    "    VERSION = 1",
    "",
    "    async def async_step_user(self, user_input=None):",
    "        \"\"\"Create the single helper entry from the UI.\"\"\"",
    "        await self.async_set_unique_id(DOMAIN)",
    "        self._abort_if_unique_id_configured()",
    "        return self.async_create_entry(title=NAME, data={})",
    "",
  ].join("\n"));
  await writeFile(join(integrationDir, "strings.json"), `${JSON.stringify({
    title: "UI Lovelace Minimalist HACS",
    config: {
      step: {
        user: {
          title: "Install generated Minimalist dashboard assets",
          description: "This helper copies generated YAML templates and snippets into www/community/ui_lovelace_minimalist_hacs.",
        },
      },
    },
  }, null, 2)}\n`);
  await writeFile(join(integrationDir, "services.yaml"), "{}\n");
  await writeFile(join(generatedDir, "source.json"), `${JSON.stringify({
    source: sourceRepo,
    generatedAt: new Date().toISOString(),
    templateCount: entries.length,
  }, null, 2)}\n`);
}

function pluginEntrypoint(templateCount: number): string {
  return `const TEMPLATE_COUNT = ${templateCount};

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
    yaml: "type: custom:button-card\\ntemplate: card_light\\nentity: light.living_room\\nvariables:\\n  ulm_card_light_enable_slider: true"
  },
  {
    title: "Room",
    yaml: "type: custom:button-card\\ntemplate: card_room\\nname: Living Room\\nentity: light.living_room\\nvariables:\\n  label_use_brightness: true"
  },
  {
    title: "Person",
    yaml: "type: custom:button-card\\ntemplate: card_person\\nentity: person.rohan\\nvariables: {}"
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
      "<div class=\\"template-grid\\">",
      ...templates.map((template) => "<code>" + escapeHtml(template) + "</code>"),
      "</div>"
    ].join("");
  }

  renderExamples(examples) {
    return examples.map((example) => [
      "<section class=\\"example\\">",
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
      "<div class=\\"content\\">",
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
`;
}

function dashboardCardExamples(): string {
  return `# These examples are for the helper dashboard card itself.
# Button-card templates such as battery_info still require the generated
# button_card_templates block from dist/ui-raw-dashboard-snippet.yaml.

# Basic status card
type: custom:ui-lovelace-minimalist-hacs

---
# Show a curated list of installed templates
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

---
# Show pasteable card examples on the dashboard
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
  - title: Room
    yaml: |
      type: custom:button-card
      template: card_room
      name: Living Room
      entity: light.living_room
      variables:
        label_use_brightness: true
  - title: Person
    yaml: |
      type: custom:button-card
      template: card_person
      entity: person.rohan
      variables: {}
`;
}

async function resolveSource(): Promise<{ path: string; label: string; cleanup?: string }> {
  const source = argValue("--source");
  if (source) {
    const absolute = source.startsWith("/") ? source : join(repoRoot, source);
    if (!existsSync(absolute)) throw new Error(`Source path does not exist: ${absolute}`);
    return { path: absolute, label: absolute };
  }

  const repo = argValue("--repo") ?? defaultRepo;
  const branch = argValue("--branch");
  const tempRoot = await mkdtemp(join(tmpdir(), "ulm-hacs-"));
  const cloneArgs = ["git", "clone", "--depth", "1"];
  if (branch) cloneArgs.push("--branch", branch);
  cloneArgs.push(repo, "source");
  await run(cloneArgs, tempRoot);
  return { path: join(tempRoot, "source"), label: branch ? `${repo}#${branch}` : repo, cleanup: tempRoot };
}

async function main() {
  const source = await resolveSource();
  try {
    const templateRoot = join(source.path, "custom_components", "ui_lovelace_minimalist", "lovelace", "ulm_templates");
    const communityRoot = join(source.path, "custom_cards");
    if (!existsSync(templateRoot)) throw new Error(`Missing template root: ${templateRoot}`);
    if (!existsSync(communityRoot)) throw new Error(`Missing community cards root: ${communityRoot}`);

    await rm(distDir, { recursive: true, force: true });
    await rm(generatedDir, { recursive: true, force: true });
    await mkdir(distDir, { recursive: true });
    await mkdir(generatedDir, { recursive: true });

    await copyTree(templateRoot, join(generatedDir, "ulm_templates"));
    await copyTree(communityRoot, join(generatedDir, "community_cards"));

    const yamlFiles = [
      ...(await listFiles(templateRoot)),
      ...(await listFiles(communityRoot)),
    ].filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"));

    const sections: string[] = [];
    const entries: TemplateEntry[] = [];
    for (const file of yamlFiles) {
      const content = stripDocumentMarker(await readFile(file, "utf8"));
      if (!content.trim()) continue;
      const rel = relative(source.path, file).replaceAll("\\", "/");
      const category = categoryFor(`/${rel}`);
      sections.push(`# Source: ${rel}\n${content}`);
      for (const name of topLevelKeys(content)) {
        entries.push({ name, source: rel, category, directUse: isDirectUse(category) });
      }
    }

    entries.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
    const bundle = `${sections.join("\n\n")}\n`;
    await writeFile(join(distDir, "button-card-templates.yaml"), bundle);
    await writeFile(join(generatedDir, "button-card-templates.yaml"), bundle);
    await writeFile(join(distDir, "ui-raw-dashboard-snippet.yaml"), `button_card_templates:\n${bundle.split("\n").map((line) => line ? `  ${line}` : line).join("\n")}`);
    await writeFile(join(generatedDir, "ui-raw-dashboard-snippet.yaml"), `button_card_templates:\n${bundle.split("\n").map((line) => line ? `  ${line}` : line).join("\n")}`);
    await writeFile(join(distDir, "template-index.json"), `${JSON.stringify(entries, null, 2)}\n`);
    await writeFile(join(generatedDir, "template-index.json"), `${JSON.stringify(entries, null, 2)}\n`);
    await writeFile(join(distDir, pluginFileName), pluginEntrypoint(entries.length));
    await writeFile(join(generatedDir, pluginFileName), pluginEntrypoint(entries.length));
    await writeFile(join(distDir, dashboardExamplesFileName), dashboardCardExamples());
    await writeFile(join(generatedDir, dashboardExamplesFileName), dashboardCardExamples());

    const snippetDir = join(distDir, "example-card-snippets");
    const generatedSnippetDir = join(generatedDir, "example-card-snippets");
    await mkdir(snippetDir, { recursive: true });
    await mkdir(generatedSnippetDir, { recursive: true });
    for (const entry of entries.filter((item) => item.directUse)) {
      const filename = `${entry.name}.yaml`;
      const snippet = snippetFor(entry.name);
      await writeFile(join(snippetDir, filename), snippet);
      await writeFile(join(generatedSnippetDir, filename), snippet);
    }

    await writeGeneratedIntegration(source.label, entries);
    console.log(`Generated ${entries.length} templates from ${source.label}`);
  } finally {
    if (source.cleanup) await rm(source.cleanup, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

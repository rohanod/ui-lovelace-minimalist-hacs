import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";

const repoRoot = join(import.meta.dir, "..");
const defaultRepo = "https://github.com/UI-Lovelace-Minimalist/UI.git";
const integrationDomain = "ui_lovelace_minimalist_hacs";
const integrationDir = join(repoRoot, "custom_components", integrationDomain);
const generatedDir = join(integrationDir, "generated");
const distDir = join(repoRoot, "dist");
const pluginFileName = "ui-lovelace-minimalist-hacs.js";
const integrationVersion = "1.0.1";
const wrapperExamplesFileName = "wrapper-card-examples.yaml";

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

function stripDocumentMarker(content: string): string {
  return content.replace(/^---\s*\r?\n/, "").trimEnd();
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
    "type: custom:ui-lovelace-minimalist-hacs",
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
    dependencies: ["http", "lovelace", "frontend"],
    documentation: "https://github.com/rohan/ui-lovelace-minimalist-hacs",
    iot_class: "calculated",
    issue_tracker: "https://github.com/rohan/ui-lovelace-minimalist-hacs/issues",
    version: integrationVersion,
  }, null, 2)}\n`);
  await writeFile(join(integrationDir, "const.py"), [
    "from __future__ import annotations",
    "",
    "import json",
    "from pathlib import Path",
    "from typing import Final",
    "",
    `DOMAIN: Final = "${integrationDomain}"`,
    `NAME: Final = "UI Lovelace Minimalist HACS"`,
    `GENERATED_PATH: Final = "generated"`,
    `RESOURCE_ROOT: Final = f"/{DOMAIN}"`,
    `RESOURCE_FILENAME: Final = "${pluginFileName}"`,
    `RESOURCE_URL: Final = f"{RESOURCE_ROOT}/{RESOURCE_FILENAME}"`,
    `WWW_RESOURCE_ROOT: Final = f"/local/community/{DOMAIN}"`,
    `WWW_RESOURCE_URL: Final = f"{WWW_RESOURCE_ROOT}/{RESOURCE_FILENAME}"`,
    "",
    `_MANIFEST_PATH = Path(__file__).parent / "manifest.json"`,
    `with _MANIFEST_PATH.open(encoding="utf-8") as manifest_file:`,
    `    VERSION: Final = json.load(manifest_file).get("version", "0.0.0")`,
    "",
    `VERSIONED_RESOURCE_FILENAME: Final = f"ui-lovelace-minimalist-hacs-v{VERSION}.js"`,
    `VERSIONED_WWW_RESOURCE_URL: Final = f"{WWW_RESOURCE_ROOT}/{VERSIONED_RESOURCE_FILENAME}"`,
    `VERSIONED_RESOURCE_URL: Final = VERSIONED_WWW_RESOURCE_URL`,
    "",
  ].join("\n"));
  await writeFile(join(integrationDir, "__init__.py"), [
    "\"\"\"UI Lovelace Minimalist HACS helper integration.\"\"\"",
    "",
    "from __future__ import annotations",
    "",
    "from collections.abc import Mapping",
    "from contextlib import suppress",
    "import logging",
    "from pathlib import Path",
    "import shutil",
    "from typing import Any",
    "",
    "from homeassistant.components.http import StaticPathConfig",
    "from homeassistant.config_entries import ConfigEntry",
    "from homeassistant.const import EVENT_HOMEASSISTANT_STARTED",
    "from homeassistant.core import CoreState, HomeAssistant",
    "from homeassistant.helpers.event import async_call_later",
    "",
    "from .const import (",
    "    DOMAIN,",
    "    RESOURCE_FILENAME,",
    "    RESOURCE_ROOT,",
    "    RESOURCE_URL,",
    "    VERSIONED_RESOURCE_FILENAME,",
    "    VERSIONED_RESOURCE_URL,",
    "    WWW_RESOURCE_URL,",
    ")",
    "",
    "_LOGGER = logging.getLogger(__name__)",
    "",
    "",
    "def _resource_path(url: str) -> str:",
    "    \"\"\"Return the resource URL without query parameters.\"\"\"",
    "    return url.split(\"?\", 1)[0]",
    "",
    "",
    "async def _async_register_static_path(hass: HomeAssistant) -> None:",
    "    \"\"\"Serve the bundled frontend module from the integration directory.\"\"\"",
    "    source = Path(__file__).parent / \"generated\"",
    "    with suppress(RuntimeError):",
    "        await hass.http.async_register_static_paths(",
    "            [StaticPathConfig(RESOURCE_ROOT, str(source), True)]",
    "        )",
    "",
    "",
    "async def _async_copy_www_resource(hass: HomeAssistant) -> None:",
    "    \"\"\"Copy the frontend module into Home Assistant's normal /local path.\"\"\"",
    "    source = Path(__file__).parent / \"generated\" / RESOURCE_FILENAME",
    "    target_dir = Path(hass.config.path(\"www\", \"community\", DOMAIN))",
    "    target = target_dir / RESOURCE_FILENAME",
    "    versioned_target = target_dir / VERSIONED_RESOURCE_FILENAME",
    "",
    "    def copy_resource() -> None:",
    "        target_dir.mkdir(parents=True, exist_ok=True)",
    "        shutil.copy2(source, target)",
    "        shutil.copy2(source, versioned_target)",
    "",
    "    await hass.async_add_executor_job(copy_resource)",
    "",
    "",
    "async def _async_register_lovelace_resource(hass: HomeAssistant) -> None:",
    "    \"\"\"Create or update the Lovelace resource in storage mode.\"\"\"",
    "    lovelace = hass.data.get(\"lovelace\")",
    "    if lovelace is None or getattr(lovelace, \"mode\", None) != \"storage\":",
    "        return",
    "",
    "    resources = getattr(lovelace, \"resources\", None)",
    "    if resources is None:",
    "        return",
    "",
    "    if not getattr(resources, \"loaded\", False):",
    "        async def _retry_resource_registration(_now: Any) -> None:",
    "            await _async_register_lovelace_resource(hass)",
    "",
    "        async_call_later(hass, 5, _retry_resource_registration)",
    "        return",
    "",
    "    existing = [",
    "        item",
    "        for item in resources.async_items()",
    "        if _resource_path(item.get(\"url\", \"\")) in {RESOURCE_URL, WWW_RESOURCE_URL}",
    "    ]",
    "    resource_config = {\"res_type\": \"module\", \"url\": VERSIONED_RESOURCE_URL}",
    "",
    "    if existing:",
    "        resource = existing[0]",
    "        if resource.get(\"url\") != VERSIONED_RESOURCE_URL or resource.get(\"res_type\") != \"module\":",
    "            await resources.async_update_item(resource[\"id\"], resource_config)",
    "            _LOGGER.info(\"Updated Lovelace resource %s\", VERSIONED_RESOURCE_URL)",
    "        return",
    "",
    "    await resources.async_create_item(resource_config)",
    "    _LOGGER.info(\"Registered Lovelace resource %s\", VERSIONED_RESOURCE_URL)",
    "",
    "",
    "async def _async_register_frontend(hass: HomeAssistant) -> None:",
    "    \"\"\"Register the static file route and Lovelace resource.\"\"\"",
    "    await _async_register_static_path(hass)",
    "    await _async_copy_www_resource(hass)",
    "    await _async_register_lovelace_resource(hass)",
    "",
    "",
    "async def async_setup(hass: HomeAssistant, config: Mapping[str, Any]) -> bool:",
    "    \"\"\"Set up frontend registration once for the integration.\"\"\"",
    "",
    "    async def _setup_frontend(_event: Any = None) -> None:",
    "        await _async_register_frontend(hass)",
    "",
    "    if hass.state == CoreState.running:",
    "        await _setup_frontend()",
    "    else:",
    "        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _setup_frontend)",
    "",
    "    return True",
    "",
    "async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:",
    "    \"\"\"Set up the helper config entry.\"\"\"",
    "    await _async_register_frontend(hass)",
    "    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {",
    "        \"resource_url\": VERSIONED_RESOURCE_URL,",
    "    }",
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
          description: "This integration registers the UI Lovelace Minimalist wrapper card resource.",
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

function pluginEntrypoint(templateCount: number, templates: Record<string, unknown>): string {
  return `const TEMPLATE_COUNT = ${templateCount};
const BUTTON_CARD_TEMPLATES = ${JSON.stringify(templates)};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const clone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const mergeConfig = (base, override) => {
  if (!isObject(base) || !isObject(override)) return clone(override);
  const merged = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    if (isObject(merged[key]) && isObject(value)) {
      merged[key] = mergeConfig(merged[key], value);
    } else {
      merged[key] = clone(value);
    }
  }
  return merged;
};

const asTemplateList = (template) => {
  if (!template) return [];
  return Array.isArray(template) ? template : [template];
};

const isLiteralTemplateName = (templateName) => typeof templateName === "string" && !templateName.trim().startsWith("[[[");

const resolveButtonCardConfig = (config, stack = []) => {
  const templates = asTemplateList(config.template);
  let resolved = {};
  for (const templateName of templates) {
    if (!isLiteralTemplateName(templateName)) continue;
    if (!BUTTON_CARD_TEMPLATES[templateName]) {
      throw new Error("UI Lovelace Minimalist template '" + templateName + "' is missing from the bundled integration.");
    }
    if (stack.includes(templateName)) {
      throw new Error("Circular UI Lovelace Minimalist template reference: " + [...stack, templateName].join(" -> "));
    }
    resolved = mergeConfig(resolved, resolveButtonCardConfig(BUTTON_CARD_TEMPLATES[templateName], [...stack, templateName]));
  }
  const ownConfig = clone(config);
  delete ownConfig.template;
  return mergeConfig(resolved, ownConfig);
};

const resolveNestedButtonCards = (value) => {
  if (Array.isArray(value)) return value.map(resolveNestedButtonCards);
  if (!isObject(value)) return value;
  let current = value;
  const templates = asTemplateList(current.template);
  if (current.type === "custom:button-card" && templates.some(isLiteralTemplateName)) {
    current = resolveButtonCardConfig(current);
    current.type = "custom:button-card";
  }
  const resolved = {};
  for (const [key, nestedValue] of Object.entries(current)) {
    resolved[key] = resolveNestedButtonCards(nestedValue);
  }
  return resolved;
};

class UiLovelaceMinimalistHacs extends HTMLElement {
  setConfig(config) {
    if (!config || !config.template) {
      throw new Error("Specify a bundled Minimalist template, for example template: card_light");
    }
    this.config = config;
    this.renderCard();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.child) this.child.hass = hass;
  }

  async renderCard() {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    try {
      const buttonCardConfig = resolveNestedButtonCards(resolveButtonCardConfig({
        ...this.config,
        type: "custom:button-card"
      }));
      buttonCardConfig.type = "custom:button-card";
      const helpers = await window.loadCardHelpers();
      const child = helpers.createCardElement(buttonCardConfig);
      if (this._hass) child.hass = this._hass;
      this.child = child;
      root.replaceChildren(child);
    } catch (error) {
      root.innerHTML = "<ha-card><div class=\\"error\\"><b>UI Lovelace Minimalist HACS</b><p>" + escapeHtml(error.message || error) + "</p></div></ha-card><style>ha-card{padding:16px}.error{display:grid;gap:8px;color:var(--error-color)}</style>";
    }
  }

  getCardSize() {
    return this.child?.getCardSize?.() || 3;
  }
}

if (!customElements.get("ui-lovelace-minimalist-hacs")) {
  customElements.define("ui-lovelace-minimalist-hacs", UiLovelaceMinimalistHacs);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ui-lovelace-minimalist-hacs",
  name: "UI Lovelace Minimalist HACS",
  description: "Renders bundled UI Lovelace Minimalist templates through one wrapper card."
});

console.info("UI Lovelace Minimalist HACS loaded with " + TEMPLATE_COUNT + " templates");
`;
}

function wrapperCardExamples(): string {
  return `# Dimmable light
type: custom:ui-lovelace-minimalist-hacs
template: card_light
entity: light.living_room
variables:
  ulm_card_light_enable_slider: true

---
# Room
type: custom:ui-lovelace-minimalist-hacs
template: card_room
name: Living Room
entity: light.living_room
variables:
  label_use_brightness: true

---
# Battery info community template
type: custom:ui-lovelace-minimalist-hacs
template: battery_info
entity: sensor.phone_battery
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

    const yamlFiles = [
      ...(await listFiles(templateRoot)),
      join(source.path, "custom_components", "ui_lovelace_minimalist", "lovelace", "custom_actions.yaml"),
      join(source.path, "custom_components", "ui_lovelace_minimalist", "lovelace", "translations", "default.yaml"),
      ...(await listFiles(communityRoot)),
    ].filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"));

    const templates: Record<string, unknown> = {};
    const entries: TemplateEntry[] = [];
    for (const file of yamlFiles) {
      const content = stripDocumentMarker(await readFile(file, "utf8"));
      if (!content.trim()) continue;
      const rel = relative(source.path, file).replaceAll("\\", "/");
      const category = categoryFor(`/${rel}`);
      const parsed = parse(content) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      for (const [name, value] of Object.entries(parsed)) {
        templates[name] = value;
        entries.push({ name, source: rel, category, directUse: isDirectUse(category) });
      }
    }

    entries.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
    await writeFile(join(distDir, "template-index.json"), `${JSON.stringify(entries, null, 2)}\n`);
    await writeFile(join(generatedDir, "template-index.json"), `${JSON.stringify(entries, null, 2)}\n`);
    await writeFile(join(distDir, pluginFileName), pluginEntrypoint(entries.length, templates));
    await writeFile(join(generatedDir, pluginFileName), pluginEntrypoint(entries.length, templates));
    await writeFile(join(distDir, wrapperExamplesFileName), wrapperCardExamples());
    await writeFile(join(generatedDir, wrapperExamplesFileName), wrapperCardExamples());

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

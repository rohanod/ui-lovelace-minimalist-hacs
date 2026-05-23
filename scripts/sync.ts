import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";

const repoRoot = join(import.meta.dir, "..");
const defaultRepo = "https://github.com/UI-Lovelace-Minimalist/UI.git";
const distDir = join(repoRoot, "dist");
const pluginFileName = "ui-lovelace-minimalist-hacs.js";
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

async function resetDirectory(root: string) {
  if (existsSync(root)) {
    await run(["rm", "-rf", root], repoRoot);
  }
  await mkdir(root, { recursive: true });
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

    await resetDirectory(distDir);

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
    await writeFile(join(distDir, pluginFileName), pluginEntrypoint(entries.length, templates));
    await writeFile(join(distDir, wrapperExamplesFileName), wrapperCardExamples());

    const snippetDir = join(distDir, "example-card-snippets");
    await mkdir(snippetDir, { recursive: true });
    for (const entry of entries.filter((item) => item.directUse)) {
      const filename = `${entry.name}.yaml`;
      const snippet = snippetFor(entry.name);
      await writeFile(join(snippetDir, filename), snippet);
    }

    console.log(`Generated ${entries.length} templates from ${source.label}`);
  } finally {
    if (source.cleanup) await rm(source.cleanup, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

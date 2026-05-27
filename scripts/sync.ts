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
const templateDataFileName = "template-data.json";

type TemplateEntry = {
  name: string;
  source: string;
  category: string;
  directUse: boolean;
  dependencies: string[];
  variables: VariableInfo[];
};

type VariableInfo = {
  name: string;
  default?: string;
  required?: boolean;
  notes?: string;
  source: string;
};

const minimalistThemeDefaults: Record<string, string> = {
  "border-radius": "20px",
  "box-shadow": "0px 2px 4px 0px rgba(0,0,0,0.16)",
  "color-theme": "51,51,51",
  "color-red": "245, 68, 54",
  "color-green": "1, 200, 82",
  "color-yellow": "255, 145, 1",
  "color-blue": "61, 90, 254",
  "color-purple": "102, 31, 255",
  "color-grey": "187, 187, 187",
  "color-pink": "233, 30, 99",
  "color-background-yellow": "250, 250, 250",
  "color-background-blue": "250, 250, 250",
  "color-background-green": "250, 250, 250",
  "color-background-red": "250, 250, 250",
  "color-background-pink": "250, 250, 250",
  "color-background-purple": "250, 250, 250",
  "color-yellow-text": "var(--primary-text-color)",
  "color-blue-text": "var(--primary-text-color)",
  "color-green-text": "var(--primary-text-color)",
  "color-red-text": "var(--primary-text-color)",
  "color-pink-text": "var(--primary-text-color)",
  "color-purple-text": "var(--primary-text-color)",
  "opacity-bg": "1",
  "google-red": "#F54436",
  "google-green": "#01C852",
  "google-yellow": "#FF9101",
  "google-blue": "#3D5AFE",
  "google-violet": "#661FFF",
  "google-grey": "#BBBBBB",
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

function makeHomeAssistantResourceLookupsSafe(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => makeHomeAssistantResourceLookupsSafe(item));
  }

  if (value && typeof value === "object") {
    const updated: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      updated[key] = makeHomeAssistantResourceLookupsSafe(child);
    }
    return updated;
  }

  if (typeof value !== "string") return value;

  return value
    .replaceAll(
      "hass.resources[hass['language']]",
      "((hass.resources && hass.resources[hass['language']]) || (hass.resources && hass.resources.en) || {})",
    )
    .replaceAll(
      "hass.resources[lang]",
      "((hass.resources && hass.resources[lang]) || (hass.resources && hass.resources.en) || {})",
    );
}

function collectCustomElementDependencies(value: unknown, dependencies = new Set<string>()): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectCustomElementDependencies(item, dependencies);
    return [...dependencies].sort();
  }

  if (!value || typeof value !== "object") return [...dependencies].sort();

  const record = value as Record<string, unknown>;
  if (typeof record.type === "string" && record.type.startsWith("custom:")) {
    const tag = record.type.slice("custom:".length);
    if (tag && tag !== "button-card" && tag !== "ui-lovelace-minimalist-hacs") {
      dependencies.add(tag);
    }
  }

  for (const child of Object.values(record)) {
    collectCustomElementDependencies(child, dependencies);
  }
  return [...dependencies].sort();
}

function cleanMarkdownCell(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/`/g, "")
    .replace(/:\w+-(check|close):/g, (match) => match.includes("check") ? "yes" : "no")
    .replace(/\s+/g, " ")
    .trim();
}

function isRequired(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  return /yes|true|required|check/i.test(value) && !/close|no|false/i.test(value);
}

function parseMarkdownVariableTables(content: string, source: string): VariableInfo[] {
  const variables: VariableInfo[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].trim().startsWith("|") || !lines[index + 1]?.includes("---")) continue;
    const headers = lines[index].split("|").slice(1, -1).map(cleanMarkdownCell);
    const variableIndex = headers.findIndex((header) => /variable/i.test(header));
    if (variableIndex < 0) continue;
    const defaultIndex = headers.findIndex((header) => /default|example/i.test(header));
    const requiredIndex = headers.findIndex((header) => /required/i.test(header));
    const notesIndex = headers.findIndex((header) => /notes|explanation|requirement/i.test(header));
    let rowIndex = index + 2;
    while (rowIndex < lines.length && lines[rowIndex].trim().startsWith("|")) {
      const cells = lines[rowIndex].split("|").slice(1, -1).map(cleanMarkdownCell);
      const name = cells[variableIndex];
      if (name && name !== "entity" && /^[A-Za-z0-9_/-]+$/.test(name)) {
        variables.push({
          name,
          default: defaultIndex >= 0 ? cells[defaultIndex] : undefined,
          required: isRequired(requiredIndex >= 0 ? cells[requiredIndex] : undefined),
          notes: notesIndex >= 0 ? cells[notesIndex] : undefined,
          source,
        });
      }
      rowIndex += 1;
    }
  }
  return variables;
}

function parseHtmlVariableTables(content: string, source: string): VariableInfo[] {
  const variables: VariableInfo[] = [];
  for (const tableMatch of content.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
      [...row[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => cleanMarkdownCell(cell[1] ?? "")),
    );
    const headers = rows[0] ?? [];
    const variableIndex = headers.findIndex((header) => /variable/i.test(header));
    if (variableIndex < 0) continue;
    const defaultIndex = headers.findIndex((header) => /default|example/i.test(header));
    const requiredIndex = headers.findIndex((header) => /required/i.test(header));
    const notesIndex = headers.findIndex((header) => /notes|explanation|requirement/i.test(header));
    for (const cells of rows.slice(1)) {
      const name = cells[variableIndex];
      if (name && /^[A-Za-z0-9_/-]+$/.test(name)) {
        variables.push({
          name,
          default: defaultIndex >= 0 ? cells[defaultIndex] : undefined,
          required: isRequired(requiredIndex >= 0 ? cells[requiredIndex] : undefined),
          notes: notesIndex >= 0 ? cells[notesIndex] : undefined,
          source,
        });
      }
    }
  }
  return variables;
}

function collectYamlVariables(value: unknown, variables = new Map<string, VariableInfo>()): Map<string, VariableInfo> {
  if (Array.isArray(value)) {
    for (const item of value) collectYamlVariables(item, variables);
    return variables;
  }
  if (!value || typeof value !== "object") return variables;

  const record = value as Record<string, unknown>;
  if (record.variables && typeof record.variables === "object" && !Array.isArray(record.variables)) {
    for (const [name, defaultValue] of Object.entries(record.variables as Record<string, unknown>)) {
      if (/^[A-Za-z0-9_]+$/.test(name) && !variables.has(name)) {
        variables.set(name, {
          name,
          default: typeof defaultValue === "string" ? cleanMarkdownCell(defaultValue) : JSON.stringify(defaultValue),
          source: "template",
        });
      }
    }
  }
  for (const child of Object.values(record)) collectYamlVariables(child, variables);
  return variables;
}

function mergeVariableInfo(template: unknown, docs: VariableInfo[]): VariableInfo[] {
  const variables = collectYamlVariables(template);
  for (const variable of docs) {
    const existing = variables.get(variable.name);
    variables.set(variable.name, {
      ...existing,
      ...variable,
      default: variable.default || existing?.default,
      source: existing ? `${existing.source}, docs` : variable.source,
    });
  }
  return [...variables.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function readDocVariables(sourcePath: string): Promise<Map<string, VariableInfo[]>> {
  const docs = new Map<string, VariableInfo[]>();
  const roots = [
    join(sourcePath, "docs", "usage", "cards"),
    join(sourcePath, "docs", "usage", "custom_cards"),
    join(sourcePath, "custom_cards"),
  ].filter(existsSync);

  for (const root of roots) {
    for (const file of (await listFiles(root)).filter((item) => item.toLowerCase().endsWith(".md"))) {
      const content = await readFile(file, "utf8");
      const variables = [
        ...parseMarkdownVariableTables(content, relative(sourcePath, file).replaceAll("\\", "/")),
        ...parseHtmlVariableTables(content, relative(sourcePath, file).replaceAll("\\", "/")),
      ];
      if (!variables.length) continue;
      const base = file.split("/").pop()?.replace(/\.md$/i, "");
      const parent = file.split("/").at(-2);
      for (const key of new Set([base, parent].filter(Boolean) as string[])) {
        docs.set(key, [...(docs.get(key) ?? []), ...variables]);
      }
    }
  }
  return docs;
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
  if (value === undefined) return undefined;
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
const isTemplateString = (value) => typeof value === "string" && value.trim().startsWith("[[[");
const isParentEntityTemplate = (value) => isTemplateString(value) && value.includes("entity.entity_id");
const referencedTemplatesInString = (value) => {
  if (!isTemplateString(value) || !value.includes("icon_info")) return [];
  return [...value.matchAll(/["']([A-Za-z0-9_ -]+)["']/g)]
    .map((match) => match[1])
    .filter((templateName, index, names) => BUTTON_CARD_TEMPLATES[templateName] && names.indexOf(templateName) === index);
};
const languageFromHass = (hass) => hass?.language || hass?.locale?.language || "en";
const customElementTagFromType = (type) => typeof type === "string" && type.startsWith("custom:")
  ? type.slice("custom:".length)
  : null;

const findMissingCustomElements = (value, missing = new Set()) => {
  if (Array.isArray(value)) {
    for (const item of value) findMissingCustomElements(item, missing);
    return [...missing].sort();
  }
  if (!isObject(value)) return [...missing].sort();

  const tag = customElementTagFromType(value.type);
  if (tag && tag !== "ui-lovelace-minimalist-hacs" && !customElements.get(tag)) {
    missing.add(tag);
  }
  for (const nestedValue of Object.values(value)) {
    findMissingCustomElements(nestedValue, missing);
  }
  return [...missing].sort();
};

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

const convertNestedButtonCards = (value, inheritedEntity) => {
  if (Array.isArray(value)) return value.map((item) => convertNestedButtonCards(item, inheritedEntity));
  if (!isObject(value)) return value;

  const configuredEntity = value.entity ?? value.entity_id;
  const ownEntity = typeof configuredEntity === "string" && !isTemplateString(configuredEntity)
    ? configuredEntity
    : inheritedEntity;

  const nestedTemplates = asTemplateList(value.template);
  const literalTemplates = nestedTemplates.filter(isLiteralTemplateName);
  const referencedTemplates = nestedTemplates.flatMap(referencedTemplatesInString);

  if (value.type === "custom:button-card" && (literalTemplates.length || referencedTemplates.length)) {
    const converted = clone(value);
    if (isParentEntityTemplate(converted.entity) && ownEntity) {
      converted.entity = ownEntity;
    }
    if (!converted.entity && !converted.entity_id && ownEntity) {
      converted.entity = ownEntity;
    }
    if (referencedTemplates.length) {
      converted.template = [...referencedTemplates, ...literalTemplates];
    }
    const resolved = resolveButtonCardConfig(converted);
    if (referencedTemplates.length && converted.state === undefined) {
      delete resolved.state;
    }
    resolved.type = "custom:button-card";
    return convertNestedButtonCards(resolved, ownEntity);
  }

  const resolved = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    resolved[key] = convertNestedButtonCards(nestedValue, ownEntity);
  }
  return resolved;
};

class UiLovelaceMinimalistHacs extends HTMLElement {
  setConfig(config) {
    if (!config || !config.template) {
      throw new Error("Specify a bundled Minimalist template, for example template: card_light");
    }
    this.style.display ||= "block";
    this.style.width ||= "100%";
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
      const normalizedConfig = {
        ...this.config,
        entity: this.config.entity ?? this.config.entity_id,
        variables: {
          ulm_language: languageFromHass(this._hass),
          ...(isObject(this.config.variables) ? this.config.variables : {})
        }
      };
      delete normalizedConfig.entity_id;
      const resolvedConfig = resolveButtonCardConfig({
        ...normalizedConfig,
        type: "custom:button-card"
      });
      const buttonCardConfig = convertNestedButtonCards(resolvedConfig, resolvedConfig.entity);
      buttonCardConfig.type = "custom:button-card";
      const missingElements = findMissingCustomElements(buttonCardConfig);
      if (missingElements.length) {
        throw new Error("Missing custom card dependenc" + (missingElements.length === 1 ? "y" : "ies") + ": " + missingElements.map((tag) => "custom:" + tag).join(", ") + ". Install the matching HACS Dashboard card resource(s), then refresh the browser.");
      }
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
    const translationRoot = join(source.path, "custom_components", "ui_lovelace_minimalist", "lovelace", "translations");
    const communityRoot = join(source.path, "custom_cards");
    if (!existsSync(templateRoot)) throw new Error(`Missing template root: ${templateRoot}`);
    if (!existsSync(translationRoot)) throw new Error(`Missing translation root: ${translationRoot}`);
    if (!existsSync(communityRoot)) throw new Error(`Missing community cards root: ${communityRoot}`);

    await resetDirectory(distDir);

    const yamlFiles = [
      ...(await listFiles(templateRoot)),
      join(source.path, "custom_components", "ui_lovelace_minimalist", "lovelace", "custom_actions.yaml"),
      ...(await listFiles(translationRoot)),
      ...(await listFiles(communityRoot)),
    ].filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"));

    const templates: Record<string, unknown> = {};
    const entries: TemplateEntry[] = [];
    const docsByTemplate = await readDocVariables(source.path);
    for (const file of yamlFiles) {
      const content = stripDocumentMarker(await readFile(file, "utf8"));
      if (!content.trim()) continue;
      const rel = relative(source.path, file).replaceAll("\\", "/");
      const category = categoryFor(`/${rel}`);
      const parsed = parse(content) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      for (const [name, value] of Object.entries(parsed)) {
        const template = makeHomeAssistantResourceLookupsSafe(value);
        templates[name] = template;
        entries.push({
          name,
          source: rel,
          category,
          directUse: isDirectUse(category),
          dependencies: collectCustomElementDependencies(template),
          variables: mergeVariableInfo(template, docsByTemplate.get(name) ?? []),
        });
      }
    }

    entries.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
    await writeFile(join(distDir, "template-index.json"), `${JSON.stringify(entries, null, 2)}\n`);
    await writeFile(join(distDir, templateDataFileName), `${JSON.stringify({ templates, theme: minimalistThemeDefaults }, null, 2)}\n`);
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

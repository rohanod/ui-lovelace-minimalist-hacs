import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const required = [
  "hacs.json",
  "custom_components/ui_lovelace_minimalist_hacs/manifest.json",
  "custom_components/ui_lovelace_minimalist_hacs/__init__.py",
  "custom_components/ui_lovelace_minimalist_hacs/config_flow.py",
  "custom_components/ui_lovelace_minimalist_hacs/generated/button-card-templates.yaml",
  "custom_components/ui_lovelace_minimalist_hacs/generated/ui-raw-dashboard-snippet.yaml",
  "custom_components/ui_lovelace_minimalist_hacs/generated/ui-lovelace-minimalist-hacs.js",
  "dist/button-card-templates.yaml",
  "dist/ui-raw-dashboard-snippet.yaml",
  "dist/ui-lovelace-minimalist-hacs.js",
  "dist/template-index.json",
];

for (const file of required) {
  if (!existsSync(join(root, file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const manifest = JSON.parse(await readFile(join(root, "custom_components/ui_lovelace_minimalist_hacs/manifest.json"), "utf8"));
if (manifest.domain !== "ui_lovelace_minimalist_hacs") {
  throw new Error(`Unexpected manifest domain: ${manifest.domain}`);
}

const templates = await readFile(join(root, "dist/template-index.json"), "utf8");
const parsed = JSON.parse(templates);
if (!Array.isArray(parsed) || parsed.length < 50) {
  throw new Error("Template index looks incomplete");
}

console.log(`OK: ${parsed.length} templates indexed`);

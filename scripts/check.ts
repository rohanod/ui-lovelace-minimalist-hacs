import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const required = [
  "hacs.json",
  "dist/ui-lovelace-minimalist-hacs.js",
  "dist/wrapper-card-examples.yaml",
  "dist/template-index.json",
  "dist/template-data.json",
  "site/index.html",
  "scripts/serve-builder.ts",
];

for (const file of required) {
  if (!existsSync(join(root, file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}

if (existsSync(join(root, "custom_components"))) {
  throw new Error("custom_components should not exist in this HACS Dashboard repository");
}

const hacs = JSON.parse(await readFile(join(root, "hacs.json"), "utf8"));
if (hacs.name !== "UI Lovelace Minimalist HACS") {
  throw new Error(`Unexpected HACS name: ${hacs.name}`);
}

if (hacs.filename !== "ui-lovelace-minimalist-hacs.js") {
  throw new Error(`Unexpected HACS filename: ${hacs.filename}`);
}

const templates = await readFile(join(root, "dist/template-index.json"), "utf8");
const parsed = JSON.parse(templates);
if (!Array.isArray(parsed) || parsed.length < 50) {
  throw new Error("Template index looks incomplete");
}

const printerTemplate = parsed.find((entry) => entry.name === "custom_card_mpse_printer");
if (!printerTemplate?.dependencies?.includes("bar-card")) {
  throw new Error("Template dependency metadata did not include bar-card for custom_card_mpse_printer");
}

const lightTemplate = parsed.find((entry) => entry.name === "card_light");
if (!lightTemplate?.variables?.some((variable) => variable.name === "ulm_card_light_enable_slider")) {
  throw new Error("Variable metadata did not include ulm_card_light_enable_slider for card_light");
}

const templateData = JSON.parse(await readFile(join(root, "dist/template-data.json"), "utf8"));
if (!templateData.templates?.card_light || !templateData.theme?.["border-radius"]) {
  throw new Error("Template data looks incomplete");
}

console.log(`OK: ${parsed.length} templates indexed`);

import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(import.meta.dir, "..");
const port = Number(Bun.env.PORT ?? 4173);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
};

function safePath(pathname: string): string {
  const cleanPath = pathname === "/" || pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const normalized = normalize(cleanPath).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(root, normalized);
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    try {
      const filePath = safePath(url.pathname);
      const body = await readFile(filePath);
      return new Response(body, {
        headers: {
          "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
});

console.log(`Card YAML builder: http://localhost:${port}/site/`);

import { build } from "esbuild";
import { cp, mkdir, readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const publicFiles = await readdir("public", { recursive: true, withFileTypes: true });
const assets = {};
for (const file of publicFiles) {
  if (!file.isFile() || file.name === "_headers") continue;

  const type = types[extname(file.name)];
  if (!type) throw new Error(`Unknown asset type: ${file.name}`);

  const path = join(file.parentPath, file.name);
  const url = "/" + path.slice("public".length + 1).replaceAll("\\", "/");
  assets[url] = {
    type,
    base64: (await readFile(path)).toString("base64"),
  };
}

const headerLines = (await readFile("public/_headers", "utf8")).trimEnd().split("\n");
if (headerLines.shift() !== "/*") throw new Error("Expected site-wide asset headers");
const assetHeaders = {};
for (const line of headerLines) {
  const separator = line.indexOf(":");
  if (separator < 1) throw new Error(`Invalid asset header: ${line}`);
  assetHeaders[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
}

await build({
  stdin: {
    contents: `
      import survey from "./src/worker.js";

      const assets = ${JSON.stringify(assets)};
      const assetHeaders = ${JSON.stringify(assetHeaders)};

      export default {
        fetch(request, env) {
          const { pathname } = new URL(request.url);
          const path = pathname === "/" ? "/index.html" : pathname;
          if (!Object.hasOwn(assets, path)) return survey.fetch(request, env);

          if (request.method !== "GET" && request.method !== "HEAD") {
            return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
          }

          const { type, base64 } = assets[path];
          const body = request.method === "HEAD"
            ? null
            : Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));

          return new Response(body, {
            headers: {
              ...assetHeaders,
              "Content-Type": type,
              "Cache-Control": "public, max-age=0, must-revalidate",
            },
          });
        },
      };
    `,
    resolveDir: process.cwd(),
    sourcefile: "sites-entry.js",
    loader: "js",
  },
  bundle: true,
  format: "esm",
  outfile: "dist/server/index.js",
});

await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");

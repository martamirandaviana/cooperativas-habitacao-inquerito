import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
// Translate the preview runner's Vite flags to Wrangler's dev options.
const options = process.argv.slice(2)
  .filter((option) => option !== "--strictPort")
  .map((option) => option.replace(/^--host(?==|$)/, "--ip"));
const result = spawnSync(process.execPath, [wrangler, "dev", "--local", ...options], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

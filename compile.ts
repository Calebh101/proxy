import { transform } from 'esbuild';
import * as fs from 'fs/promises';

const path = process.argv[2] || "config.ts";
const target = process.argv[3] || "config.js";

async function minify(code: string, loader: "ts" | "js" = "ts"): Promise<string> {
  const result = await transform(code, {
    loader: loader,
    minify: true,
    target: 'es2020',
  });

  return result.code.trim();
}

(async () => {
  const loaded = await fs.readFile(path, "utf-8");
  const code = await minify(loaded);

  console.log(code);
  await fs.writeFile(target, code);
})();
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

async function findTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findTests(path));
    } else if (entry.name.endsWith(".test.ts")) {
      files.push(path);
    }
  }

  return files;
}

const files = (await findTests("tests")).sort();

if (files.length === 0) {
  console.error("No unit test files found.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);

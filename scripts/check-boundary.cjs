const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..", "src");
const forbidden = [
  /src[\\/]runtime[\\/]/,
  /legacy[\\/]/,
  /ProgressController/,
  /SelectViewerController/,
  /globalThis/,
  /Object\.assign\(globalThis/,
  /\bUI\./,
  /\bEventBus\b/,
  /\bEVENTS\b/,
  /\bAlertHelper\b/,
  /\bALERT_MESSAGES\b/,
  /\bENV\b/,
  /document_pwa/,
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const failures = [];
for (const file of walk(root)) {
  if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(file) || pattern.test(source)) {
      failures.push(`${file}: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

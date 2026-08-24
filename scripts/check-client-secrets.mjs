// TRD-4.3 / Plan Stage 8: verify no secret reaches the client bundle.
// Scans .next/static for env var NAMES that must be server-only and for the actual values from .env.local if present.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SERVER_ONLY = ["SUPABASE_SERVICE_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "ENCRYPTION_KEY", "SHARE_TOKEN_SECRET", "RESEND_API_KEY", "DATABASE_URL"];
const root = ".next/static";
if (!existsSync(root)) {
  console.error("No .next/static — run `npm run build` first.");
  process.exit(2);
}

const values = new Map();
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && SERVER_ONLY.includes(m[1]) && m[2].trim().length >= 12) values.set(m[1], m[2].trim().replace(/^"|"$/g, ""));
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|css|txt|json)$/.test(name)) out.push(p);
  }
  return out;
}

let bad = 0;
for (const file of walk(root)) {
  const src = readFileSync(file, "utf8");
  for (const name of SERVER_ONLY) {
    if (src.includes(`process.env.${name}`) || src.includes(`"${name}"`)) {
      console.error(`✗ ${file}: references server-only env ${name}`);
      bad++;
    }
  }
  for (const [name, val] of values) {
    if (src.includes(val)) {
      console.error(`✗ ${file}: contains the VALUE of ${name}`);
      bad++;
    }
  }
}
if (bad) {
  console.error(`\n${bad} problem(s). A secret is reaching the client bundle.`);
  process.exit(1);
}
console.log(`✓ No server-only secrets found in ${root} (${SERVER_ONLY.length} names checked, ${values.size} values checked).`);

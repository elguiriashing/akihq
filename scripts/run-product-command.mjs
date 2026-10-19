import { spawnSync } from "node:child_process";
import path from "node:path";

const [command, ...args] = process.argv.slice(2);
const executables = {
  build: path.join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  ),
  test: path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs"),
};

if (!executables[command]) {
  console.error(
    "Usage: node scripts/run-product-command.mjs <build|test> [...files]",
  );
  process.exit(2);
}

const defaults = {
  NEXT_PUBLIC_AKISUITE_ROLE_SWAP: "true",
  NEXT_PUBLIC_PRODUCT_NAME: "AkiHQ",
  NEXT_PUBLIC_SITE_URL: "https://akihq.app",
  NEXT_PUBLIC_BUSINESS_URL: "https://akibusiness.com",
  NEXT_PUBLIC_CRM_URL: "https://akihq.app",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-disposable-placeholder",
};

const result = spawnSync(
  process.execPath,
  command === "test"
    ? [executables[command], "run", "--environment", "node", ...args]
    : [executables[command], "build", ...args],
  {
    stdio: "inherit",
    env: { ...defaults, ...process.env },
  },
);

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

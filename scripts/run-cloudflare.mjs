import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { sourceCommit, stampReleaseSource } from "./release-source.mjs";

const action = process.argv[2];
if (action !== "build") {
  console.error("Usage: node scripts/run-cloudflare.mjs build");
  process.exit(2);
}

const cli = path.join(
  process.cwd(),
  "node_modules",
  "@opennextjs",
  "cloudflare",
  "dist",
  "cli",
  "index.js",
);
const commit = sourceCommit();
// Generated adapter state must not accumulate exports or stale asset chunks.
rmSync(path.join(process.cwd(), ".open-next"), {
  recursive: true,
  force: true,
});
const result = spawnSync(process.execPath, [cli, action], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_AKISUITE_ROLE_SWAP:
      process.env.NEXT_PUBLIC_AKISUITE_ROLE_SWAP || "true",
    NEXT_PUBLIC_PRODUCT_NAME: process.env.NEXT_PUBLIC_PRODUCT_NAME || "AkiHQ",
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL || "https://akihq.app",
    NEXT_PUBLIC_BUSINESS_URL:
      process.env.NEXT_PUBLIC_BUSINESS_URL || "https://akibusiness.com",
    NEXT_PUBLIC_CRM_URL: process.env.NEXT_PUBLIC_CRM_URL || "https://akihq.app",
    NEXT_PUBLIC_DATA_PROVIDER: "hybrid",
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status === 0) {
  if (sourceCommit() !== commit) {
    throw new Error(
      "Source changed during release packaging; rebuild before deploy",
    );
  }
  stampReleaseSource(commit);
}
process.exit(result.status ?? 1);

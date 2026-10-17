#!/usr/bin/env node
/**
 * Generate verified domain association JSON only AFTER Play App Signing and Apple
 * developer team identities have been assigned. No files are deployed from here.
 *
 * Usage:
 * ANDROID_APP_SIGNING_SHA256="AA:BB:...(32 bytes)" APPLE_TEAM_ID="ABCDEFGHIJ" \
 *   node mobile/generate-associations.mjs
 *
 * Use the PLAY APP SIGNING certificate fingerprint, not the upload certificate.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const config = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "store-release.json"), "utf8"));
const raw = process.env.ANDROID_APP_SIGNING_SHA256 || "";
const fingerprint = raw.toUpperCase().replaceAll(":", "");
const team = (process.env.APPLE_TEAM_ID || "").toUpperCase();
if (!new RegExp("^[0-9A-F]{64}$").test(fingerprint)) {
  console.error("Set ANDROID_APP_SIGNING_SHA256 to the real 32-byte Play App Signing SHA-256 fingerprint.");
  process.exit(1);
}
if (!new RegExp("^[A-Z0-9]{10}$").test(team)) {
  console.error("Set APPLE_TEAM_ID to the actual 10-character Apple Developer Team ID.");
  process.exit(1);
}
const universalLinks = (process.env.APPLE_UNIVERSAL_LINK_PATHS || "")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);
if (
  universalLinks.length === 0 ||
  universalLinks.some(
    (path) =>
      path === "*" ||
      path === "/*" ||
      !path.startsWith("/") ||
      path.includes("..") ||
      path.includes("?"),
  )
) {
  console.error(
    "Set APPLE_UNIVERSAL_LINK_PATHS to reviewed, scoped routes. Catch-all links are forbidden.",
  );
  process.exit(1);
}
const certificate = fingerprint.match(/.{2}/g).join(":");
const android = [{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: { namespace: "android_app", package_name: config.proposedIdentifiers.androidApplicationId, sha256_cert_fingerprints: [certificate] }
}];
const apple = { applinks: { apps: [], details: [{ appID: team + "." + config.proposedIdentifiers.iosBundleId, paths: ["*"] }] } };
console.log("# " + config.webOrigin + "/.well-known/assetlinks.json");
console.log(JSON.stringify(android, null, 2));
console.log("# " + config.webOrigin + "/.well-known/apple-app-site-association (application/json, no redirect)");
console.log(JSON.stringify(apple, null, 2));
console.log("# Verify with devices and platform tools before publishing. Proposed IDs must first be finalized.");

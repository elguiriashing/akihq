#!/usr/bin/env node
/**
 * Dependency-free repository metadata gate. This does NOT compile a native app.
 * node mobile/validate-store-release.mjs           -> metadata consistency
 * node mobile/validate-store-release.mjs --ship    -> fail unless every release gate is complete
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const directory = dirname(fileURLToPath(import.meta.url));
const fail = (reason) => { console.error("Mobile release: " + reason); process.exitCode = 1; };
let data;
try { data = JSON.parse(readFileSync(join(directory, "store-release.json"), "utf8")); }
catch (err) { fail("Unable to parse store-release.json: " + err.message); process.exit(1); }
const idPattern = new RegExp("^[a-z][a-z0-9]*(?:[.][a-z][a-z0-9]*){2,}$");
const { proposedIdentifiers: ids, listingDraft: listing, gates, platformRequirements: req } = data;
if (data.schemaVersion !== 1) fail("Unsupported schema version");
if (!data.product || !String(data.webOrigin || "").startsWith("https://") || !new RegExp("^https://[a-z0-9.-]+$").test(data.webOrigin || "")) fail("Invalid product/webOrigin");
if (!ids || !idPattern.test(ids.androidApplicationId || "") || !idPattern.test(ids.iosBundleId || ""))
  fail("Invalid proposed mobile IDs (must be at least three dot-separated parts)");
if (!req || req.googlePlayTargetApiMinimum < 36 || req.iosBuildWithXcodeMajorMinimum < 26)
  fail("Outdated Google Play/Apple build requirements");
if (!listing || listing.primaryLocale !== "es-ES" || !listing.shortDescriptionEs || !listing.shortDescriptionEn)
  fail("Missing Spanish/English listing drafts");
if (!gates || Object.keys(gates).length < 10 || Object.values(gates).some(v => typeof v !== "boolean"))
  fail("Missing or invalid ship gates");
if (process.argv.includes("--ship")) {
  if (data.status !== "READY_FOR_INTERNAL_REVIEW") fail("Status is not READY_FOR_INTERNAL_REVIEW");
  for (const [name, passed] of Object.entries(gates || {})) if (!passed) fail("Release gate not verified: " + name);
  for (const name of ["fullDescriptionEs", "fullDescriptionEn", "privacyPolicyUrl", "supportUrl"]) {
    if (!listing?.[name]) fail("Required store metadata is empty: " + name);
  }
  console.log("Configuration gates met. Build, signing, store checks and real-device QA STILL required.");
} else if (!process.exitCode) {
  console.log(data.product + ": metadata format valid; " +
    Object.values(gates).filter(Boolean).length + "/" + Object.keys(gates).length +
    " release gates verified. Run with --ship for strict gating.");
}

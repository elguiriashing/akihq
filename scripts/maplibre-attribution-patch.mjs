import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// MapLibre upstream PR #8189 / GHSA-jrc7-96c5-q579:
// https://github.com/maplibre/maplibre-gl-js/pull/8189
// Snapshot the live NamedNodeMap before removing attributes. Keep the existing
// BSD-3-Clause vendor notices and the 5.12.0 worker/module/WebGL behavior.
// Patched bundles no longer advertise their now-stale upstream source maps.
export const MAPLIBRE_VERSION = "5.12.0";
export const PATCH_TARGETS = Object.freeze(
  [
    {
      file: "src/util/dom.ts",
      before: "for (const {name, value} of elem.attributes) {",
      after: "for (const {name, value} of Array.from(elem.attributes)) {",
      pristine:
        "18352698c36a6d160c2b6a70b74260e555af15a4c7c493f5107ba34439969914",
      patched:
        "7141995bba3c5afab612ba3ff16cf82d5edd2dab284215894a407d68a36d80e3",
    },
    {
      file: "dist/maplibre-gl.js",
      before:
        "static removeAttributes(e){for(const{name:t,value:i}of e.attributes)",
      after:
        "static removeAttributes(e){for(const{name:t,value:i}of Array.from(e.attributes))",
      pristine:
        "06b392de571c99e242581b0f3f23893e6e95efd3656974d6edfd8f8599ddf362",
      patched:
        "b4bb88ddf7fe2a2c28e5ce9fc68917081ff1ddaee560eb8b12ab09387ce38d1a",
    },
    {
      file: "dist/maplibre-gl-dev.js",
      before: "for (const { name, value } of elem.attributes) {",
      after: "for (const { name, value } of Array.from(elem.attributes)) {",
      pristine:
        "f632e50365588ddb098ea7e327ed44b5dd56142e8f0a2430f874adc8a2c9488d",
      patched:
        "283af7807b02178c1faef7c72ed6a674a83be972ee6ae82e13bb01d0234bc906",
    },
    {
      file: "dist/maplibre-gl-csp.js",
      before:
        "static removeAttributes(e){for(const{name:t,value:i}of e.attributes)",
      after:
        "static removeAttributes(e){for(const{name:t,value:i}of Array.from(e.attributes))",
      pristine:
        "797d6c520fee4d07d895ea9a969ef67c96fb88bcf70f47fc5ac7a17daa0bd9c1",
      patched:
        "855dd73a3e99a626b5e88d249b8a2a52ebbda562464d7d6a2ccc51e52ad24133",
    },
    {
      file: "dist/maplibre-gl-csp-dev.js",
      before: "for (const { name, value } of elem.attributes) {",
      after: "for (const { name, value } of Array.from(elem.attributes)) {",
      pristine:
        "89eb29e5908980325c256d4906eae555fccec4bf271eb9c0868782fdf02772c8",
      patched:
        "2b939e2a022eedc17f2d4383e89f73c41893d2f61749a7d88379f446dcb04a6e",
    },
  ].map(Object.freeze),
);

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function occurrences(content, text) {
  return content.split(text).length - 1;
}

export function sourceMapReference(target) {
  return target.file.startsWith("dist/")
    ? `//# sourceMappingURL=${path.basename(target.file)}.map\n`
    : "";
}

export function patchMapLibreAttribution({
  packageDirectory = fileURLToPath(
    new URL("../node_modules/maplibre-gl/", import.meta.url),
  ),
  check = false,
} = {}) {
  const metadata = JSON.parse(
    readFileSync(path.join(packageDirectory, "package.json"), "utf8"),
  );
  if (
    metadata.name !== "maplibre-gl" ||
    metadata.version !== MAPLIBRE_VERSION ||
    metadata.license !== "BSD-3-Clause" ||
    metadata.main !== "dist/maplibre-gl.js" ||
    metadata.type !== "module" ||
    ["exports", "browser", "module"].some((field) =>
      Object.hasOwn(metadata, field),
    )
  ) {
    throw new Error(
      `Expected BSD-3-Clause maplibre-gl ${MAPLIBRE_VERSION} with its pinned runtime entry; found ${metadata.name} ${metadata.version} (${metadata.license}). Review the backport before changing the dependency.`,
    );
  }

  // Read and validate every file before writing any file. A mixture of known
  // pristine/patched files is a failed partial installation, not a repair input.
  const validated = PATCH_TARGETS.map((target) => {
    const filename = path.join(packageDirectory, target.file);
    const content = readFileSync(filename, "utf8");
    const digest = sha256(content);
    const state =
      digest === target.pristine
        ? "pristine"
        : digest === target.patched
          ? "patched"
          : "unknown";
    if (state === "unknown") {
      throw new Error(
        `Unrecognized MapLibre content: ${target.file} (${digest}).`,
      );
    }
    const reference = sourceMapReference(target);
    if (
      occurrences(
        content,
        state === "pristine" ? target.before : target.after,
      ) !== 1 ||
      occurrences(
        content,
        state === "pristine" ? target.after : target.before,
      ) !== 0 ||
      (reference &&
        (occurrences(content, "sourceMappingURL") !==
          (state === "pristine" ? 1 : 0) ||
          (state === "pristine" && !content.endsWith(reference))))
    ) {
      throw new Error(
        `Unexpected MapLibre sanitizer structure: ${target.file}.`,
      );
    }
    const patched =
      state === "patched"
        ? content
        : content.replace(target.before, target.after).replace(reference, "");
    if (sha256(patched) !== target.patched) {
      throw new Error(`Backport output hash mismatch: ${target.file}.`);
    }
    return { filename, patched, state };
  });
  const states = new Set(validated.map((target) => target.state));
  if (states.size !== 1) {
    throw new Error(
      "Partial MapLibre backport detected. Reinstall dependencies.",
    );
  }
  if (states.has("patched")) return "verified";
  if (check) {
    throw new Error(
      "MapLibre attribution backport is missing. Run npm install with lifecycle scripts enabled before building.",
    );
  }
  for (const target of validated) {
    writeFileSync(target.filename, target.patched);
  }
  return "applied";
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    let packageDirectory;
    let check = false;
    for (const argument of process.argv.slice(2)) {
      if (argument === "--check") check = true;
      else if (argument.startsWith("--package-dir=")) {
        packageDirectory = path.resolve(
          argument.slice("--package-dir=".length),
        );
      } else throw new Error(`Unknown argument: ${argument}`);
    }
    const result = patchMapLibreAttribution({ packageDirectory, check });
    console.log(`MapLibre ${MAPLIBRE_VERSION} attribution backport ${result}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

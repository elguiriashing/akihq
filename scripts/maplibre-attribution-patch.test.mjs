import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TextDecoder, TextEncoder } from "node:util";
import { JSDOM } from "jsdom";
import {
  MAPLIBRE_VERSION,
  PATCH_TARGETS,
  patchMapLibreAttribution,
  sha256,
  sourceMapReference,
} from "./maplibre-attribution-patch.mjs";

const require = createRequire(import.meta.url);
const installedDirectory = path.dirname(
  path.dirname(require.resolve("maplibre-gl")),
);
const script = fileURLToPath(
  new URL("./maplibre-attribution-patch.mjs", import.meta.url),
);
const bundles = PATCH_TARGETS.filter((target) =>
  target.file.startsWith("dist/"),
);

function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "akisuite-maplibre-"));
  mkdirSync(path.join(directory, "src/util"), { recursive: true });
  mkdirSync(path.join(directory, "dist"));
  for (const file of ["package.json", "LICENSE.txt"]) {
    copyFileSync(
      path.join(installedDirectory, file),
      path.join(directory, file),
    );
  }
  for (const target of PATCH_TARGETS) {
    let content = readFileSync(
      path.join(installedDirectory, target.file),
      "utf8",
    );
    // A lifecycle-patched install can still supply a byte-exact pristine
    // fixture. Its pinned original hash prevents a fabricated vendor baseline.
    if (sha256(content) === target.patched) {
      content = content.replace(target.after, target.before);
      content += sourceMapReference(target);
    }
    assert.equal(sha256(content), target.pristine, target.file);
    writeFileSync(path.join(directory, target.file), content);
  }
  return directory;
}

function snapshot(directory) {
  return PATCH_TARGETS.map((target) =>
    sha256(readFileSync(path.join(directory, target.file))),
  );
}

function withFixture(run) {
  const directory = fixture();
  try {
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function nativeAttribution(directory, bundle, attribution, run) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://map-test.example.invalid/",
    runScripts: "outside-only",
  });
  try {
    // Evaluate the vendor UMD bundle only. No map, worker, renderer, external
    // resources or event-handler execution is enabled in this inert DOM.
    dom.window.URL.createObjectURL = () => "blob:inert-maplibre-test";
    dom.window.TextDecoder = TextDecoder;
    dom.window.TextEncoder = TextEncoder;
    dom.window.Worker = class {
      constructor() {
        throw new Error("Attribution tests must not create workers");
      }
    };
    dom.window.fetch = () => {
      throw new Error("Attribution tests must not make network requests");
    };
    dom.window.eval(readFileSync(path.join(directory, bundle.file), "utf8"));
    const { AttributionControl } = dom.window.maplibregl;
    assert.equal(typeof AttributionControl, "function");
    const listeners = new Map();
    const canvas = dom.window.document.createElement("div");
    const source = { attribution };
    const map = {
      style: {
        stylesheet: { version: 8, sources: {}, layers: [] },
        tileManagers: { provider: { used: true, getSource: () => source } },
      },
      _getUIString: () => "Toggle attribution",
      getCanvasContainer: () => canvas,
      on: (event, listener) => listeners.set(event, listener),
      off: (event) => listeners.delete(event),
    };
    const control = new AttributionControl({ compact: true });
    const container = control.onAdd(map);
    dom.window.document.body.append(container);
    run({ control, container, source, listeners, window: dom.window });
    assert.equal(dom.window.__attributionHandlerRan, undefined);
    control.onRemove();
    assert.equal(container.isConnected, false);
    assert.equal(listeners.size, 0);
  } finally {
    dom.window.close();
  }
}

test("installed MapLibre is the exact backported version before it can ship", () => {
  assert.equal(
    patchMapLibreAttribution({
      packageDirectory: installedDirectory,
      check: true,
    }),
    "verified",
  );
});

test("pristine check fails without writes; apply is exact and idempotent", () =>
  withFixture((directory) => {
    const before = snapshot(directory);
    const license = readFileSync(path.join(directory, "LICENSE.txt"));
    const untouchedFiles = [
      "dist/maplibre-gl.css",
      "dist/maplibre-gl-csp-worker.js",
      "dist/maplibre-gl-csp-worker-dev.js",
      ...bundles.map((bundle) => `${bundle.file}.map`),
    ];
    const untouchedHashes = untouchedFiles.map((file) => {
      copyFileSync(
        path.join(installedDirectory, file),
        path.join(directory, file),
      );
      return sha256(readFileSync(path.join(directory, file)));
    });
    assert.throws(
      () =>
        patchMapLibreAttribution({ packageDirectory: directory, check: true }),
      /backport is missing/,
    );
    assert.deepEqual(snapshot(directory), before);
    assert.equal(
      patchMapLibreAttribution({ packageDirectory: directory }),
      "applied",
    );
    assert.deepEqual(
      snapshot(directory),
      PATCH_TARGETS.map((target) => target.patched),
    );
    assert.equal(
      patchMapLibreAttribution({ packageDirectory: directory }),
      "verified",
    );
    assert.equal(
      patchMapLibreAttribution({ packageDirectory: directory, check: true }),
      "verified",
    );
    assert.deepEqual(
      readFileSync(path.join(directory, "LICENSE.txt")),
      license,
    );
    assert.deepEqual(
      untouchedFiles.map((file) =>
        sha256(readFileSync(path.join(directory, file))),
      ),
      untouchedHashes,
    );
    for (const bundle of bundles) {
      const content = readFileSync(path.join(directory, bundle.file), "utf8");
      assert.match(content, /@license 3-Clause BSD/);
      assert.doesNotMatch(content, /sourceMappingURL/);
    }
  }));

for (const [description, mutate, message] of [
  [
    "unknown bundle bytes",
    (directory) => {
      const filename = path.join(directory, bundles.at(-1).file);
      writeFileSync(
        filename,
        `${readFileSync(filename, "utf8")}\n// tampered\n`,
      );
    },
    /Unrecognized MapLibre content/,
  ],
  [
    "partial loop-only patch with stale source map",
    (directory) => {
      const target = bundles[0];
      const filename = path.join(directory, target.file);
      writeFileSync(
        filename,
        readFileSync(filename, "utf8").replace(target.before, target.after),
      );
    },
    /Unrecognized MapLibre content/,
  ],
  [
    "mixed pristine and known patched files",
    (directory) => {
      const target = PATCH_TARGETS[0];
      const filename = path.join(directory, target.file);
      writeFileSync(
        filename,
        readFileSync(filename, "utf8").replace(target.before, target.after),
      );
    },
    /Partial MapLibre backport/,
  ],
  [
    "duplicated sanitizer loop",
    (directory) => {
      const target = PATCH_TARGETS[0];
      const filename = path.join(directory, target.file);
      writeFileSync(
        filename,
        `${readFileSync(filename, "utf8")}\n${target.before}\n`,
      );
    },
    /Unrecognized MapLibre content/,
  ],
]) {
  test(`rejects ${description} before writing any other target`, () =>
    withFixture((directory) => {
      mutate(directory);
      const before = snapshot(directory);
      assert.throws(
        () => patchMapLibreAttribution({ packageDirectory: directory }),
        message,
      );
      assert.deepEqual(snapshot(directory), before);
    }));
}

for (const [field, value] of [
  ["version", "6.4.1"],
  ["version", "5.12.1"],
  ["name", "different-package"],
  ["license", "unknown"],
  ["main", "dist/unpatched-entry.js"],
  ["type", "commonjs"],
  ["exports", { ".": "./dist/unpatched-entry.js" }],
  ["browser", "dist/unpatched-entry.js"],
  ["module", "dist/unpatched-entry.js"],
]) {
  test(`rejects unexpected package ${field}=${value} without writes`, () =>
    withFixture((directory) => {
      const filename = path.join(directory, "package.json");
      const metadata = JSON.parse(readFileSync(filename, "utf8"));
      metadata[field] = value;
      writeFileSync(filename, JSON.stringify(metadata));
      const before = snapshot(directory);
      assert.throws(
        () => patchMapLibreAttribution({ packageDirectory: directory }),
        new RegExp(`Expected BSD-3-Clause maplibre-gl ${MAPLIBRE_VERSION}`),
      );
      assert.deepEqual(snapshot(directory), before);
    }));
}

test("CLI checker fails pristine and verifies a patched package", () =>
  withFixture((directory) => {
    const args = [script, "--check", `--package-dir=${directory}`];
    assert.throws(() =>
      execFileSync(process.execPath, args, { stdio: "pipe" }),
    );
    const output = execFileSync(
      process.execPath,
      [script, `--package-dir=${directory}`],
      { encoding: "utf8" },
    );
    assert.match(output, /backport applied/);
    assert.match(
      execFileSync(process.execPath, args, { encoding: "utf8" }),
      /backport verified/,
    );
    assert.throws(() =>
      execFileSync(process.execPath, [script, "--unexpected"], {
        stdio: "pipe",
      }),
    );
  }));

test("a missing last target fails before changing earlier files", () =>
  withFixture((directory) => {
    const earlierTargets = PATCH_TARGETS.slice(0, -1);
    const hashes = earlierTargets.map((target) =>
      sha256(readFileSync(path.join(directory, target.file))),
    );
    rmSync(path.join(directory, PATCH_TARGETS.at(-1).file));
    assert.throws(
      () => patchMapLibreAttribution({ packageDirectory: directory }),
      /ENOENT/,
    );
    assert.deepEqual(
      earlierTargets.map((target) =>
        sha256(readFileSync(path.join(directory, target.file))),
      ),
      hashes,
    );
  }));

const marker = "window.__attributionHandlerRan=true";
const consecutive = `<details open onload="${marker}" ontoggle="${marker}"><summary>Provider credits</summary>Details</details>`;
const nested = `<section onmouseover="${marker}" onclick="${marker}"><a href="java\nscript:${marker}" onclick="${marker}" onfocus="${marker}">Bad link</a><details open onload="${marker}" ontoggle="${marker}"><summary>Nested credits</summary><img src="data:image/svg+xml,inert" onerror="${marker}" onload="${marker}"></details></section>`;
const safe =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a><details open><summary>More credits</summary>Provider text</details>';

for (const bundle of bundles) {
  test(`${bundle.file}: pristine native AttributionControl reproduces the adjacent-attribute skip inertly`, () =>
    withFixture((directory) => {
      nativeAttribution(directory, bundle, consecutive, ({ container }) => {
        const details = container.querySelector(
          ".maplibregl-ctrl-attrib-inner details",
        );
        assert.equal(details.hasAttribute("onload"), false);
        assert.equal(details.getAttribute("ontoggle"), marker);
      });
    }));

  test(`${bundle.file}: actual patched native control removes consecutive and nested dangerous attributes`, () =>
    withFixture((directory) => {
      patchMapLibreAttribution({ packageDirectory: directory });
      nativeAttribution(
        directory,
        bundle,
        consecutive,
        ({ container, source, listeners }) => {
          const inner = container.querySelector(
            ".maplibregl-ctrl-attrib-inner",
          );
          assert.equal(
            inner.querySelector("details").hasAttribute("open"),
            true,
          );
          assert.equal(
            inner.querySelector("summary").textContent,
            "Provider credits",
          );
          assert.equal(
            inner.querySelector("details").hasAttribute("onload"),
            false,
          );
          assert.equal(
            inner.querySelector("details").hasAttribute("ontoggle"),
            false,
          );
          source.attribution = nested;
          listeners.get("sourcedata")({ sourceDataType: "metadata" });
          for (const element of inner.querySelectorAll("*")) {
            for (const attribute of element.attributes) {
              assert.equal(attribute.name.startsWith("on"), false);
              if (["href", "src", "xlink:href"].includes(attribute.name)) {
                assert.doesNotMatch(
                  attribute.value.replace(/\s/g, ""),
                  /javascript:|data:/i,
                );
              }
            }
          }
          assert.equal(inner.querySelector("a").textContent, "Bad link");
          assert.equal(
            inner.querySelector("details").hasAttribute("open"),
            true,
          );
          assert.equal(
            inner.querySelector("summary").textContent,
            "Nested credits",
          );
          assert.equal(inner.querySelector("img").hasAttribute("src"), false);
        },
      );
    }));

  test(`${bundle.file}: safe OSM attribution and native disclosure survive the backport`, () =>
    withFixture((directory) => {
      patchMapLibreAttribution({ packageDirectory: directory });
      nativeAttribution(directory, bundle, safe, ({ container, control }) => {
        const link = container.querySelector(".maplibregl-ctrl-attrib-inner a");
        assert.equal(
          link.getAttribute("href"),
          "https://www.openstreetmap.org/copyright",
        );
        assert.equal(link.getAttribute("target"), "_blank");
        assert.equal(link.getAttribute("rel"), "noopener");
        assert.equal(link.textContent, "© OpenStreetMap contributors");
        assert.equal(container.localName, "details");
        assert.equal(container.firstElementChild.localName, "summary");
        assert.equal(
          container.firstElementChild.getAttribute("aria-label"),
          "Toggle attribution",
        );
        assert.equal(
          container.querySelector(".maplibregl-ctrl-attrib-inner summary")
            .textContent,
          "More credits",
        );
        assert.equal(
          container.classList.contains("maplibregl-compact-show"),
          true,
        );
        control._toggleAttribution();
        assert.equal(
          container.classList.contains("maplibregl-compact-show"),
          false,
        );
        control._toggleAttribution();
        assert.equal(
          container.classList.contains("maplibregl-compact-show"),
          true,
        );
      });
    }));
}

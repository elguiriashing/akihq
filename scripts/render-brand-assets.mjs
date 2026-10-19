// Source-controlled rendering for the approved AkiHQ identity.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Resvg } = require(
  path.join(
    process.env.RUNNER_TEMP,
    "brand-render",
    "node_modules",
    "@resvg",
    "resvg-js",
  ),
);
const render = (file, size) =>
  new Resvg(fs.readFileSync(file, "utf8"), {
    fitTo: { mode: "width", value: size },
  })
    .render()
    .asPng();
const root = "public";
for (const size of [32, 180, 192, 512])
  fs.writeFileSync(
    path.join(root, `icon-${size}.png`),
    render("public/brand/hq-mark.svg", size),
  );
fs.writeFileSync(
  "public/brand/hq-icon.png",
  render("public/brand/hq-mark.svg", 512),
);
for (const size of [192, 512]) {
  fs.writeFileSync(
    `public/brand/hq-maskable-${size}.png`,
    render("public/brand/hq-maskable.svg", size),
  );
}
console.log("Rendered AkiHQ brand icons");

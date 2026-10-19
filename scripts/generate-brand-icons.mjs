// Keep AkiHQ browser, installable PWA and Apple icons in sync with the SVG mark.
// This release branch deploys to akihq.app; do not change the separate AB operations icon.
import { readFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const normal = await readFile(resolve(root, "public/brand/hq-mark.svg"));
const maskable = await readFile(resolve(root, "public/brand/hq-maskable.svg"));
const targets = [
  ...[32, 180, 192, 512].map((size) => [
    normal,
    size,
    `public/brand/hq-v2-${size}.png`,
  ]),
  ...[192, 512].map((size) => [
    maskable,
    size,
    `public/brand/hq-v2-maskable-${size}.png`,
  ]),
];
for (const [source, size, path] of targets) {
  const target = resolve(root, path);
  await mkdir(dirname(target), { recursive: true });
  await sharp(source).resize(size, size).png().toFile(target);
}

import sharp from "sharp";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const base = process.cwd();
for (const [repo, own] of [["akihq", "hq"]]) {
  const root = base,
    pub = resolve(root, repo === "AkiBusiness" ? "assets" : "public"),
    family = resolve(pub, "brand/v3");
  const put = async (p, b) => {
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, b);
  };
  for (const k of ["pasa", "duermo", "coches", "hq", "business"]) {
    const svg = await readFile(resolve(family, k + ".svg")),
      mask = await readFile(resolve(family, k + "-maskable.svg"));
    for (const size of [32, 180, 192, 512, 1024])
      await put(
        resolve(family, `${k}-${size}.png`),
        await sharp(svg).resize(size).png().toBuffer(),
      );
    for (const size of [192, 512])
      await put(
        resolve(family, `${k}-maskable-${size}.png`),
        await sharp(mask).resize(size).png().toBuffer(),
      );
    if (repo !== "AkiBusiness") {
      for (const size of [192, 512]) {
        const alias = k === "pasa" ? "akipasa" : k;
        await copyFile(
          resolve(family, `${k}-${size}.png`),
          resolve(pub, `pwa/${alias}-${size}.png`),
        ).catch(async () => {
          await mkdir(resolve(pub, "pwa"), { recursive: true });
          await copyFile(
            resolve(family, `${k}-${size}.png`),
            resolve(pub, `pwa/${alias}-${size}.png`),
          );
        });
        await copyFile(
          resolve(family, `${k}-maskable-${size}.png`),
          resolve(pub, `pwa/${alias}-maskable-${size}.png`),
        );
      }
      const alias = k === "coches" ? "conduzco" : k;
      for (const size of [32, 180, 192, 512]) {
        for (const stem of [`${alias}-${size}`, `${alias}-v2-${size}`]) {
          const file = resolve(pub, `brand/${stem}.png`);
          try {
            await readFile(file);
            await copyFile(resolve(family, `${k}-${size}.png`), file);
          } catch {}
        }
      }
      for (const size of [192, 512])
        for (const stem of [
          `${alias}-maskable-${size}`,
          `${alias}-v2-maskable-${size}`,
        ]) {
          const file = resolve(pub, `brand/${stem}.png`);
          try {
            await readFile(file);
            await copyFile(resolve(family, `${k}-maskable-${size}.png`), file);
          } catch {}
        }
      if (["business", "duermo", "hq"].includes(k))
        await copyFile(
          resolve(family, `${k}-512.png`),
          resolve(pub, `brand/${k}-icon.png`),
        );
    }
  }
  for (const size of [32, 180, 192, 512])
    await put(
      resolve(
        pub,
        repo === "AkiBusiness" ? `icons/icon-${size}.png` : `icon-${size}.png`,
      ),
      await readFile(resolve(family, `${own}-${size}.png`)),
    );
  // Mobile artwork is supplied for every product, including those with only store preparation.
  await put(
    resolve(root, "mobile/icons/store-1024.png"),
    await sharp(await readFile(resolve(family, own + "-maskable.svg")))
      .resize(1024)
      .png()
      .toBuffer(),
  );
  const icon = await readFile(resolve(family, own + "-maskable.svg"), "utf8");
  const foreground = icon.replace(/<rect[^>]+\/>/, "");
  await put(
    resolve(root, "mobile/icons/adaptive-foreground.png"),
    await sharp(Buffer.from(foreground)).resize(432).png().toBuffer(),
  );
  await put(
    resolve(root, "mobile/icons/background.txt"),
    {
      pasa: "#14213D",
      duermo: "#143C43",
      coches: "#3B101B",
      hq: "#252830",
      business: "#090e28",
    }[own] + "\n",
  );
  if (repo === "akipasa")
    await put(
      resolve(
        root,
        "Android/app/src/main/res/drawable-nodpi/ic_launcher_foreground.png",
      ),
      await readFile(resolve(root, "mobile/icons/adaptive-foreground.png")),
    );
}

/* Shared selector acceptance. No runtime dependencies; caller supplies Playwright. */
module.exports = async function exercisePointerBrowsing(page, expect, locale) {
  const scene = page.locator(".aks-selector__scene");
  const next = scene.getByRole("button", {
    name: locale === "es" ? "Opción siguiente" : "Next option",
    exact: true,
  });
  const previous = scene.getByRole("button", {
    name: locale === "es" ? "Opción anterior" : "Previous option",
    exact: true,
  });
  const card = (name) => page.getByRole("link", { name, exact: true });
  const selected = (name) =>
    expect(card(name)).toHaveAttribute("data-selected", "true");
  const original = page.url();
  await page.locator(".aks-selector__card[data-selected=true]").press("Home");
  await next.click();
  await selected("AkiDuermo");
  await previous.click();
  await selected("AkiPasa");
  await previous.click();
  await selected("AkiBusiness");
  await next.click();
  await selected("AkiPasa");
  const bounds = await scene.boundingBox();
  for (const [control, side] of [
    [previous, "left"],
    [next, "right"],
  ]) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(
      bounds.y + bounds.height + 1,
    );
    if (side === "left")
      expect(box.x).toBeLessThan(bounds.x + bounds.width * 0.2);
    else expect(box.x).toBeGreaterThan(bounds.x + bounds.width * 0.7);
  }
  const drag = async (name, direction) => {
    const icon = card(name);
    await icon.hover();
    const start = await icon.boundingBox();
    const x = start.x + start.width / 2,
      y = start.y + start.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + direction * 30, y, { steps: 4 });
    await expect(scene).toHaveAttribute("data-dragging", "true");
    const shift = await icon.evaluate((node) => node.getBoundingClientRect().x);
    expect(direction * (shift - start.x)).toBeGreaterThan(20);
    // Release outside the scene to exercise real pointer capture, not synthetic swipes.
    await page.mouse.move(
      direction < 0 ? bounds.x - 10 : bounds.x + bounds.width + 10,
      y,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect(scene).not.toHaveAttribute("data-dragging");
    expect(
      await scene.evaluate((node) =>
        node.style.getPropertyValue("--aks-drag-offset"),
      ),
    ).toBe("");
    expect(page.url()).toBe(original);
  };
  await drag("AkiPasa", -1);
  await selected("AkiDuermo");
  await drag("AkiDuermo", 1);
  await selected("AkiPasa");
  await card("AkiPasa").hover();
  const b = await card("AkiPasa").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2, {
    steps: 4,
  });
  await page.mouse.up();
  await selected("AkiPasa");
  expect(page.url()).toBe(original);
  await next.press("Enter");
  await selected("AkiDuermo");
  await previous.press("Space");
  await selected("AkiPasa");
  expect(page.url()).toBe(original);
  // A release outside the scene before capture must not turn hover into dragging.
  const pending = await card("AkiPasa").boundingBox();
  await page.mouse.move(pending.x + pending.width / 2, pending.y + 10);
  await page.mouse.down();
  await page.mouse.move(pending.x + pending.width / 2, bounds.y - 20);
  await page.mouse.up();
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await expect(scene).not.toHaveAttribute("data-dragging");
  // Use browser touch input so implicit capture begins on the card descendant.
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await card("AkiPasa").press("Home");
  const touchBounds = await card("AkiPasa").boundingBox();
  const touchX = touchBounds.x + touchBounds.width / 2;
  const touchY = touchBounds.y + touchBounds.height / 2;
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchX, y: touchY }],
  });
  for (const offset of [20, 40, 65, 85]) {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: touchX - offset, y: touchY }],
    });
  }
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await selected("AkiDuermo");
  expect(page.url()).toBe(original);
  await card("AkiDuermo").press("Home");
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await touch.detach();
  await page.evaluate(() =>
    document.fonts.load('600 11px "Aki Selector Poppins"'),
  );
  const fonts = await page
    .locator(".aks-selector__label")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const style = getComputedStyle(node);
        return {
          family: style.fontFamily,
          color: style.color,
          weight: style.fontWeight,
          lines: new Set([...range.getClientRects()].map((rect) => rect.top))
            .size,
          textWidth: range.getBoundingClientRect().width,
          faceWidth: node.parentElement.getBoundingClientRect().width,
        };
      }),
    );
  expect(
    await page.evaluate(() =>
      document.fonts.check('600 11px "Aki Selector Poppins"'),
    ),
  ).toBe(true);
  expect(fonts.map((f) => f.color)).toEqual([
    "rgb(242, 107, 29)",
    "rgb(47, 194, 165)",
    "rgb(255, 48, 71)",
    "rgb(255, 197, 51)",
    "rgb(154, 112, 250)",
  ]);
  for (const f of fonts) {
    expect(f.family).toContain("Aki Selector Poppins");
    expect(f.weight).toBe("600");
    expect(f.lines).toBe(1);
    expect(f.textWidth).toBeLessThanOrEqual(f.faceWidth + 1);
  }
};

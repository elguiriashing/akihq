import { it, expect } from "vitest";
import { listingMediaUsage } from "../src/lib/listing-media-usage";
it("counts only owned and actually placed assets rather than every available workspace image", () => {
  const available = Array.from({ length: 1000 }, (_, i) => `available-${i}`);
  expect(available.length).toBe(1000);
  expect(
    listingMediaUsage(["own"], [available[0], available[0]], [available[1]]),
  ).toBe(3);
  expect(listingMediaUsage(["own"], [], [])).toBe(1);
});
it("deduplicates own/shared multiple slots and includes retained IDs without preview URLs", () => {
  expect(
    listingMediaUsage(
      ["own", "unavailable-preview"],
      ["own", "shared", "shared", undefined],
      ["shared", "event-only"],
    ),
  ).toBe(4);
  expect(listingMediaUsage(["own"], [undefined], [])).toBe(1);
});

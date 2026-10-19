import { describe, expect, it } from "vitest";
import {
  businessCategories,
  businessPackageTools,
  getBusinessPackageHighlights,
} from "../src/lib/business-packages";

describe("business package highlights", () => {
  it("never advertises Pro-only tools as included in Basic", () => {
    const food = businessCategories[0];
    expect(getBusinessPackageHighlights(food, "business")).toEqual([
      "sales",
      "crm",
      "employees",
    ]);
    expect(getBusinessPackageHighlights(food, "business_pro")).toEqual([
      "pos",
      "inventory",
      "sales",
    ]);
  });

  it("changes the highlights with the venue type", () => {
    const music = businessCategories.find(
      (category) => category.key === "music",
    )!;
    const workshops = businessCategories.find(
      (category) => category.key === "workshop",
    )!;
    expect(getBusinessPackageHighlights(music, "business_pro")).toEqual([
      "calendar",
      "employees",
      "collaboration",
    ]);
    expect(getBusinessPackageHighlights(workshops, "business")).toEqual([
      "employees",
      "tasks",
      "knowledge",
    ]);
  });

  it("keeps every venue preview to three distinct included tools", () => {
    for (const category of businessCategories) {
      for (const plan of ["business", "business_pro"] as const) {
        const highlights = getBusinessPackageHighlights(category, plan);
        expect(highlights).toHaveLength(3);
        expect(new Set(highlights).size).toBe(3);
        expect(businessPackageTools[plan]).toEqual(
          expect.arrayContaining(highlights),
        );
      }
    }
  });
});

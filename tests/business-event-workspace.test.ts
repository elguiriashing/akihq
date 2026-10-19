import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const catalogue = readFileSync(
  "src/components/BusinessEventCatalogue.tsx",
  "utf8",
);
const composer = readFileSync(
  "src/components/BusinessEventComposer.tsx",
  "utf8",
);

describe("AkiBusiness event catalogue and media selection contracts", () => {
  it("limits pages to nine and resets pagination for search and status changes", () => {
    expect(catalogue).toContain("const PAGE_SIZE = 9");
    expect(catalogue).toContain("setSearch(event.target.value)");
    expect(catalogue).toContain("setStatus(filter.value)");
    expect(catalogue.match(/setPage\(1\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("labels the current group accurately in both languages", () => {
    expect(catalogue).toContain("Current and upcoming");
    expect(catalogue).toContain("Actuales y próximos");
  });
  it("supports both languages, responsive grids, and accessible filter state", () => {
    expect(catalogue).toContain('locale === "es"');
    expect(catalogue).toContain("aria-pressed={status === filter.value}");
    expect(catalogue).toContain("max-width: 850px");
    expect(catalogue).toContain("max-width: 540px");
  });
  it("contains keyboard focus in the image library and restores it on close", () => {
    expect(composer).toContain('aria-modal="true"');
    expect(composer).toContain('event.key === "Escape"');
    expect(composer).toContain('event.key === "Tab"');
    expect(composer).toContain("previousFocus?.focus()");
    expect(composer).toContain("openerRef.current = event.currentTarget");
  });
});

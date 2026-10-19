import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("structured venue claim form and privacy contract", () => {
  const page = readFileSync("src/app/[locale]/business/page.tsx", "utf8");
  const actions = readFileSync("src/app/[locale]/business/actions.ts", "utf8");
  const migration = readFileSync(
    "database/migrations/20261010231500_venue_claim_details.sql",
    "utf8",
  );

  it("collects labelled EN/ES, mobile-friendly claim contact details", () => {
    for (const name of [
      "applicantName",
      "businessRole",
      "applicantPhone",
      "businessEmail",
      "businessWebsite",
      "businessPhone",
      "evidence",
    ]) {
      expect(page).toContain(`name="${name}"`);
    }
    expect(page).toContain("Nombre y apellidos");
    expect(page).toContain("Full name");
    expect(page).toContain("Teléfono del local (opcional)");
    expect(page).toContain("Venue phone number (optional)");
    expect(page).toContain('name="businessRole" required');
    expect(page).toContain("No cambian la ficha pública");
  });

  it("validates applicant fields server-side and never edits the public venue or profile", () => {
    expect(actions).toContain(
      "applicantName: z.string().trim().min(2).max(120)",
    );
    expect(actions).toContain("businessRole: z.enum");
    expect(actions).toContain("businessEmail: z.union");
    expect(actions).toContain("claim_details: {");
    expect(actions).toContain("applicant_name: parsed.data.applicantName");
    expect(actions).toContain('supabase.from("venue_claims").insert');
    const code = actions.slice(
      actions.indexOf("export async function submitVenueClaim"),
      actions.indexOf("const eventSchema"),
    );
    expect(code).not.toContain('.from("venues").update');
    expect(code).not.toContain('.from("profiles").update');
  });

  it("preserves legacy claim evidence, staff-only review and ownership controls", () => {
    expect(migration).toContain("add column if not exists claim_details");
    expect(migration).toContain("'submission',c.claim_details");
    expect(migration).toContain("staff role required");
    expect(migration).toContain(
      "revoke all on function public.staff_pending_venue_claims",
    );
  });
});

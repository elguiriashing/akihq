import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createEventSlug, createVenueSlug } from "../src/lib/business";

describe("business onboarding", () => {
  it("creates a safe venue URL without asking the owner for technical input", () => {
    const slug = createVenueSlug("Café Niño & Más");

    expect(slug).toMatch(/^cafe-nino-mas-[a-f0-9]{6}$/);
  });

  it("creates a safe event URL without asking the owner for technical input", () => {
    const slug = createEventSlug("Noche de Jazz & Tapas");

    expect(slug).toMatch(/^noche-de-jazz-tapas-[a-f0-9]{6}$/);
  });

  it("keeps business editing locale-first and translates the saved copy server-side", () => {
    const businessPage = readFileSync(
      "src/app/[locale]/business/page.tsx",
      "utf8",
    );
    const venuePage = readFileSync(
      "src/app/[locale]/business/venue/[id]/page.tsx",
      "utf8",
    );
    const businessActions = readFileSync(
      "src/app/[locale]/business/actions.ts",
      "utf8",
    );
    const venueActions = readFileSync(
      "src/app/[locale]/business/venue/[id]/actions.ts",
      "utf8",
    );
    const translation = readFileSync("src/lib/localized-copy.ts", "utf8");

    for (const source of [businessPage, venuePage]) {
      expect(source).not.toContain('name="descriptionEs"');
      expect(source).not.toContain('name="descriptionEn"');
      expect(source).not.toContain('name="titleEs"');
      expect(source).not.toContain('name="titleEn"');
    }
    expect(businessPage).toContain(
      '{view === "events" && regularManaged.length > 0 && (',
    );
    expect(businessPage).not.toContain(
      '(view === "venues" || view === "events")',
    );
    expect(businessActions).toContain("translateLocalizedFields");
    expect(venueActions).toContain("translateLocalizedFields");
    expect(translation).toContain("AKIPASA_TRANSLATION_URL");
    expect(translation).toContain("translationEndpoints");
    expect(translation).toContain("translate.terraprint.co/translate");
    expect(translation).toContain("trans.zillyhuhn.com/translate");
    expect(translation).toContain("source: sourceLocale");
    expect(translation).toContain("target: targetLocale");
    expect(translation).toContain("application/x-www-form-urlencoded");
    expect(translation).toContain("q: value");
    expect(translation).not.toContain("q: values");
    expect(translation).not.toContain("createAIProvider");
  });

  it("lets an owner unlink a venue without deleting its public catalogue", () => {
    const migration = readFileSync(
      "database/migrations/0073_unclaim_owned_venue.sql",
      "utf8",
    );
    const actions = readFileSync(
      "src/app/[locale]/business/venue/[id]/actions.ts",
      "utf8",
    );
    const page = readFileSync(
      "src/app/[locale]/business/venue/[id]/page.tsx",
      "utf8",
    );

    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("'claim_status', 'unclaimed'");
    expect(migration).toContain("'venue_kept_public', true");
    expect(migration).toContain("revoke all on function");
    expect(migration).not.toContain("delete from public.venues");
    expect(actions).toContain('z.literal("UNCLAIM")');
    expect(actions).toContain('supabase.rpc("unclaim_owned_venue"');
    expect(page).toContain("Desvincular sin borrar");
  });

  it("isolates Business Pro CRM workspaces and caps each business at four seats", () => {
    const migration = readFileSync(
      "database/migrations/0074_crm_multi_tenant_workspaces.sql",
      "utf8",
    );
    const businessActions = readFileSync(
      "src/app/[locale]/business/actions.ts",
      "utf8",
    );

    expect(migration).toContain("crm_can_access_workspace");
    expect(migration).toContain("Business Pro subscription required");
    expect(migration).toContain("workspace seat limit reached");
    expect(migration).toContain("crm_staff_set_workspace_tool");
    expect(migration).toContain("crm_inventory_recommendations");
    expect(migration).toContain("crm_record_pos_sale");
    expect(migration).toContain("grant update (\n  sku,name,unit");
    expect(migration).not.toContain(
      "grant select,insert,update,delete on public.crm_inventory_items",
    );
    expect(businessActions).toContain("crm_provision_workspace_for_venue");
  });
});

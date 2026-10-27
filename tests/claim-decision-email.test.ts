import { expect, it } from "vitest";
import { renderClaimDecision } from "../src/lib/claim-decision-email";

const claim = {
  claimId: "10000000-0000-4000-8000-000000000010",
  venueId: "10000000-0000-4000-8000-000000000005",
  venueName: "Route 66 <script>",
  applicantName: "Owner <script>",
  reason: "Ownership verified <proof>",
  locale: "en" as const,
  decision: "approved" as const,
};

it("renders AkiHQ-managed AkiPasa Premium claims in EN and ES", () => {
  for (const locale of ["en", "es"] as const) {
    const mail = renderClaimDecision({ ...claim, locale });
    expect(mail.text).toContain(
      `https://akihq.app/${locale}/business/venue/${claim.venueId}`,
    );
    expect(mail.text).toContain(
      `https://akipasa.com/${locale}/business/early-partner?claim=${claim.claimId}`,
    );
    expect(mail.text).toContain("AkiHQ");
    expect(mail.text).toContain("AkiPasa Premium");
    expect(mail.text).not.toContain("AkiBusiness");
    expect(mail.text).toContain(locale === "es" ? "3 meses" : "3 months");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  }
});

it("keeps claim denials linked to AkiHQ without Premium promises", () => {
  for (const locale of ["en", "es"] as const) {
    const mail = renderClaimDecision({
      ...claim,
      locale,
      decision: "rejected",
    });
    expect(mail.text).toContain(
      `https://akihq.app/${locale}/business?view=claims&venueId=${claim.venueId}`,
    );
    expect(mail.text).toContain("AkiHQ");
    expect(mail.text).not.toContain("AkiBusiness");
    expect(mail.text).not.toContain("early-partner");
    expect(mail.text).not.toContain("3 months");
    expect(mail.text).not.toContain("3 meses");
  }
});

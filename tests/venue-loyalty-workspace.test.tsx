import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  VenueLoyaltyWorkspace,
  type StampCard,
} from "../src/components/VenueLoyaltyWorkspace";

const noop = async () => {};
const card: StampCard = {
  id: "11111111-1111-4111-8111-111111111111",
  title_es: "Regular",
  title_en: "Regular",
  reward_es: "Café gratis",
  reward_en: "Free Coffee",
  stamps_required: 7,
  active: true,
  loyalty_program_rewards: [
    {
      reward_id: "22222222-2222-4222-8222-222222222222",
      business_rewards: { claim_window_days: 14, active: true },
    },
  ],
};

const render = (locale: "en" | "es", cards: StampCard[]) =>
  renderToStaticMarkup(
    <VenueLoyaltyWorkspace
      locale={locale}
      venueId="33333333-3333-4333-8333-333333333333"
      programs={cards}
      offers={[]}
      redemptions={[]}
      saveCard={noop}
      toggleCard={noop}
      removeCard={noop}
      saveOffer={noop}
      confirmRedemption={noop}
    />,
  );

describe("venue loyalty workspace", () => {
  it("shows existing legacy cards as editable forms with removal and pause controls", () => {
    const html = render("en", [card]);
    expect(html).toContain("Free Coffee");
    expect(html).toContain("Edit card");
    expect(html).toContain("Save changes");
    expect(html).toContain("Pause card");
    expect(html).toContain("Remove or archive");
    expect(html).toContain('name="programId"');
    expect(html).toContain('value="14"');
    expect(html).not.toContain("Assign a reward");
    expect(html).not.toContain("Earned from");
  });

  it("shows unlinked cards as needing a prize and keeps prize optional for drafts", () => {
    const html = render("en", [
      {
        ...card,
        active: false,
        loyalty_program_rewards: [],
        reward_es: "Premio sin configurar",
        reward_en: "Reward not configured",
      },
    ]);
    expect(html).toContain("Prize needed");
    expect(html).toContain("inactive draft");
    expect(html).toContain("New stamp card");
    expect(html).toContain("Create card");
    expect(html).toContain("confirmRemoval");
  });

  it("localises the controls into Spanish and never shows separate passport assignment", () => {
    const html = render("es", [card]);
    expect(html).toContain("Tarjetas de sellos y premios");
    expect(html).toContain("Guardar cambios");
    expect(html).toContain("Pausar tarjeta");
    expect(html).not.toContain("Asignar recompensa");
  });
});

import type { ReactNode } from "react";
import { Icon } from "./Icons";

type Action = (formData: FormData) => void | Promise<void>;
type LinkedReward = {
  reward_id: string;
  business_rewards?: {
    claim_window_days: number;
    active: boolean;
  } | null;
};
export type StampCard = {
  id: string;
  title_es: string;
  title_en: string | null;
  reward_es: string;
  reward_en: string | null;
  stamps_required: number;
  active: boolean;
  loyalty_program_rewards?: LinkedReward[] | null;
};
export type PendingStampRedemption = {
  id: string;
  requested_at: string;
  profiles: { display_name: string | null } | null;
};
type Offer = {
  id: string;
  title_es: string;
  title_en: string | null;
  status: string;
  audience: string;
};

function HiddenContext({
  locale,
  venueId,
  programId,
}: {
  locale: string;
  venueId: string;
  programId?: string;
}) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="venueId" value={venueId} />
      {programId && <input type="hidden" name="programId" value={programId} />}
    </>
  );
}

function StampFields({ es, card }: { es: boolean; card?: StampCard }) {
  const assigned = Boolean(card?.loyalty_program_rewards?.length);
  return (
    <>
      <div className="form-grid-two">
        <label>
          {es ? "Nombre de la tarjeta" : "Card name"}
          <input
            name="title"
            minLength={3}
            maxLength={160}
            required
            defaultValue={
              card ? (es ? card.title_es : card.title_en || card.title_es) : ""
            }
            placeholder={es ? "Cliente habitual" : "Regular visitor"}
          />
        </label>
        <label>
          {es ? "Sellos necesarios" : "Stamps required"}
          <input
            name="stampsRequired"
            type="number"
            min={2}
            max={50}
            defaultValue={card?.stamps_required || 5}
            required
          />
        </label>
      </div>
      <div className="form-grid-two">
        <label>
          {es
            ? "Premio al completar la tarjeta"
            : "Prize when the card is completed"}
          <input
            name="reward"
            minLength={3}
            maxLength={500}
            defaultValue={
              card &&
              (assigned ||
                !/(?:Reward not configured|Premio sin configurar)/i.test(
                  card.reward_es,
                ))
                ? es
                  ? card.reward_es
                  : card.reward_en || card.reward_es
                : ""
            }
            placeholder={es ? "Ej. Café gratis" : "E.g. Free coffee"}
          />
          <small>
            {es
              ? "Opcional. Sin premio, la tarjeta se guarda como borrador inactivo."
              : "Optional. Without a prize, the card is saved as an inactive draft."}
          </small>
        </label>
        <label>
          {es ? "Días para reclamar el premio" : "Days to claim the prize"}
          <input
            name="claimWindowDays"
            type="number"
            min={1}
            max={365}
            required
            defaultValue={
              card?.loyalty_program_rewards?.[0]?.business_rewards
                ?.claim_window_days || 30
            }
          />
        </label>
      </div>
    </>
  );
}

export function VenueLoyaltyWorkspace({
  locale,
  venueId,
  programs,
  offers,
  redemptions,
  saveCard,
  toggleCard,
  removeCard,
  saveOffer,
  confirmRedemption,
  feedback,
}: {
  locale: "es" | "en";
  venueId: string;
  programs: StampCard[];
  offers: Offer[];
  redemptions: PendingStampRedemption[];
  saveCard: Action;
  toggleCard: Action;
  removeCard: Action;
  saveOffer: Action;
  confirmRedemption: Action;
  feedback?: string;
}) {
  const es = locale === "es";
  const active = programs.filter(
    (program) => program.active && program.loyalty_program_rewards?.length,
  );
  const draft = programs.filter(
    (program) => !program.active || !program.loyalty_program_rewards?.length,
  );
  const renderCards = (cards: StampCard[]): ReactNode =>
    cards.map((card) => {
      const hasPrize = Boolean(card.loyalty_program_rewards?.length);
      const ready = card.active && hasPrize;
      return (
        <details className="stamp-card" key={card.id}>
          <summary>
            <span className="status-pill">
              {ready
                ? es
                  ? "Activa"
                  : "Active"
                : hasPrize
                  ? es
                    ? "Pausada"
                    : "Paused"
                  : es
                    ? "Configurar premio"
                    : "Prize needed"}
            </span>
            <h3>{es ? card.title_es : card.title_en || card.title_es}</h3>
            <p>{es ? card.reward_es : card.reward_en || card.reward_es}</p>
            <small>
              {card.stamps_required} {es ? "sellos" : "stamps"} ·{" "}
              {es ? "Editar tarjeta" : "Edit card"} ↓
            </small>
          </summary>
          <form action={saveCard} className="stack compact-action-form">
            <HiddenContext
              locale={locale}
              venueId={venueId}
              programId={card.id}
            />
            <StampFields es={es} card={card} />
            <button className="button primary" type="submit">
              {es ? "Guardar cambios" : "Save changes"}
            </button>
          </form>
          <div className="stack">
            <form action={toggleCard} className="inline-form">
              <HiddenContext
                locale={locale}
                venueId={venueId}
                programId={card.id}
              />
              <input
                type="hidden"
                name="active"
                value={card.active ? "false" : "true"}
              />
              <button
                type="submit"
                className="button secondary"
                disabled={!card.active && !hasPrize}
              >
                {card.active
                  ? es
                    ? "Pausar tarjeta"
                    : "Pause card"
                  : es
                    ? "Reactivar tarjeta"
                    : "Reactivate card"}
              </button>
            </form>
            <form action={removeCard} className="stack">
              <HiddenContext
                locale={locale}
                venueId={venueId}
                programId={card.id}
              />
              <label>
                <input
                  type="checkbox"
                  name="confirmRemoval"
                  value="yes"
                  required
                />{" "}
                {es
                  ? "Entiendo que se eliminará si no tiene historial; de lo contrario se archivará para conservar los sellos."
                  : "Remove this card. Cards with existing customer history are archived to preserve stamps."}
              </label>
              <button type="submit" className="button secondary">
                {es ? "Eliminar o archivar" : "Remove or archive"}
              </button>
            </form>
          </div>
        </details>
      );
    });
  return (
    <section className="panel loyalty-workbench reward-hub">
      <div className="workspace-inline-heading">
        <div>
          <span className="eyebrow">
            {es ? "Fidelidad del local" : "Venue loyalty"}
          </span>
          <h2>
            {es ? "Tarjetas de sellos y premios" : "Stamp cards & prizes"}
          </h2>
          <p>
            {es
              ? "Crea la tarjeta y su premio en el mismo lugar. Pulsa una tarjeta para modificarla."
              : "Create a card and its prize together. Open any card to edit, pause or remove it."}
          </p>
        </div>
        <span className="status-pill">
          {active.length} {es ? "activas" : "active"}
        </span>
      </div>
      {feedback && (
        <p className="notice notice-error" role="alert">
          {feedback === "stamp"
            ? es
              ? "No se pudo guardar la tarjeta. Comprueba los campos y permisos."
              : "The card could not be saved. Check the fields and your access."
            : es
              ? "No se pudo completar la operación. Inténtalo de nuevo."
              : "The action failed. Please retry."}
        </p>
      )}
      {active.length > 0 && (
        <>
          <h3>{es ? "Tarjetas activas" : "Active cards"}</h3>
          <div className="reward-card-list">{renderCards(active)}</div>
        </>
      )}
      {draft.length > 0 && (
        <>
          <h3>
            {es ? "Borradores y tarjetas pausadas" : "Drafts & paused cards"}
          </h3>
          <div className="reward-card-list">{renderCards(draft)}</div>
        </>
      )}
      <div className="reward-action-grid">
        <details
          className="workspace-action-card reward-action-card"
          open={programs.length === 0}
        >
          <summary>
            <span className="workspace-action-summary">
              <span className="summary-icon">
                <Icon name="gift" />
              </span>
              <span>
                <strong>
                  {es ? "Nueva tarjeta de sellos" : "New stamp card"}
                </strong>
                <small>
                  {es
                    ? "Un formulario para la tarjeta y el premio"
                    : "Card and prize in one step"}
                </small>
              </span>
            </span>
          </summary>
          <form action={saveCard} className="stack compact-action-form">
            <HiddenContext locale={locale} venueId={venueId} />
            <StampFields es={es} />
            <button type="submit" className="button primary">
              {es ? "Crear tarjeta" : "Create card"}
            </button>
          </form>
        </details>
        <details className="workspace-action-card reward-action-card">
          <summary>
            <span className="workspace-action-summary">
              <span className="summary-icon">
                <Icon name="megaphone" />
              </span>
              <span>
                <strong>{es ? "Oferta temporal" : "Limited-time offer"}</strong>
                <small>
                  {es
                    ? "Una promoción con fecha de inicio y fin"
                    : "A promotion with start and end dates"}
                </small>
              </span>
            </span>
          </summary>
          <form action={saveOffer} className="stack compact-action-form">
            <HiddenContext locale={locale} venueId={venueId} />
            <div className="form-grid-two">
              <label>
                {es ? "Título" : "Title"}
                <input
                  name="title"
                  required
                  placeholder={es ? "2x1 los martes" : "2-for-1 Tuesdays"}
                />
              </label>
              <label>
                {es ? "Quién puede verla" : "Who can see it"}
                <select name="audience" defaultValue="public">
                  <option value="public">
                    {es ? "Todo el mundo" : "Everyone"}
                  </option>
                  <option value="premium">Premium</option>
                </select>
              </label>
            </div>
            <label>
              {es ? "Condiciones" : "Terms"}
              <textarea
                name="terms"
                required
                minLength={10}
                rows={3}
                placeholder={
                  es
                    ? "Solo consumo en local. No acumulable."
                    : "Dine-in only. Cannot be combined with other offers."
                }
              />
            </label>
            <div className="form-grid-two">
              <label>
                {es ? "Empieza" : "Starts"}
                <input type="datetime-local" name="startsAt" required />
              </label>
              <label>
                {es ? "Termina" : "Ends"}
                <input type="datetime-local" name="endsAt" required />
              </label>
            </div>
            <button type="submit" className="button">
              {es ? "Crear oferta" : "Create offer"}
            </button>
          </form>
        </details>
      </div>
      {offers.length > 0 && (
        <div className="compact-managed-list">
          <h3>{es ? "Ofertas existentes" : "Existing offers"}</h3>
          {offers.map((offer) => (
            <div className="managed-row" key={offer.id}>
              <strong>
                {es ? offer.title_es : offer.title_en || offer.title_es}
              </strong>
              <span>
                {offer.status} ·{" "}
                {offer.audience === "premium"
                  ? "Premium"
                  : es
                    ? "Pública"
                    : "Public"}
              </span>
            </div>
          ))}
        </div>
      )}
      {redemptions.length > 0 && (
        <div className="compact-managed-list">
          <h3>
            {es ? "Premios pendientes de entrega" : "Pending reward handovers"}
          </h3>
          {redemptions.map((item) => (
            <form
              action={confirmRedemption}
              className="managed-row"
              key={item.id}
            >
              <HiddenContext locale={locale} venueId={venueId} />
              <input type="hidden" name="redemptionId" value={item.id} />
              <strong>
                {item.profiles?.display_name || (es ? "Usuario" : "Customer")}
              </strong>
              <button className="button primary" type="submit">
                {es ? "Confirmar entrega" : "Confirm handover"}
              </button>
            </form>
          ))}
        </div>
      )}
    </section>
  );
}

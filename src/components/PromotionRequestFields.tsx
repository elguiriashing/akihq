"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/lib/config";
import { promotionServiceLabel } from "../lib/promotion-labels";

type PromotionVenue = { id: string; name: string };
type PromotionEvent = { id: string; venueId: string; title: string };

export function PromotionRequestFields({
  locale,
  venues,
  events,
}: {
  locale: Locale;
  venues: PromotionVenue[];
  events: PromotionEvent[];
}) {
  const [venueId, setVenueId] = useState(venues[0]?.id || "");
  const [service, setService] = useState("featured_listing");
  const matchingEvents = useMemo(
    () => events.filter((event) => event.venueId === venueId),
    [events, venueId],
  );
  const es = locale === "es";

  return (
    <>
      <div className="form-grid-two">
        <label>
          {es ? "Local" : "Venue"}
          <select
            name="venueId"
            required
            value={venueId}
            onChange={(event) => setVenueId(event.target.value)}
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {es ? "Tipo de servicio" : "Service type"}
          <select
            name="service"
            value={service}
            onChange={(event) => setService(event.target.value)}
          >
            <option value="featured_listing">
              {promotionServiceLabel("featured_listing", locale)}
            </option>
            <option value="social_campaign">
              {promotionServiceLabel("social_campaign", locale)}
            </option>
            <option value="content_package">
              {promotionServiceLabel("content_package", locale)}
            </option>
            <option value="other">
              {promotionServiceLabel("other", locale)}
            </option>
          </select>
        </label>
      </div>

      <label>
        {service === "featured_listing"
          ? es
            ? "Evento que quieres destacar"
            : "Event to feature"
          : es
            ? "Evento relacionado (opcional)"
            : "Related event (optional)"}
        <select
          key={venueId}
          name="eventId"
          required={service === "featured_listing"}
          defaultValue=""
        >
          <option value="">
            {matchingEvents.length
              ? es
                ? "Selecciona un evento"
                : "Select an event"
              : es
                ? "Este local no tiene eventos publicados"
                : "This venue has no published events"}
          </option>
          {matchingEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
        {service === "featured_listing" && !matchingEvents.length ? (
          <small>
            {es
              ? "Publica un evento antes de solicitar un destacado."
              : "Publish an event before requesting a feature."}
          </small>
        ) : null}
      </label>
    </>
  );
}

// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AccommodationBookingWorkspace } from "../src/components/AccommodationBookingWorkspace";
import { VenueDashboard } from "../src/components/VenueDashboard";

afterEach(cleanup);

const counts = {
  photos: 0,
  events: 0,
  programs: 0,
  credentials: 0,
  requests: 0,
  members: 1,
};

describe("AkiDuermo business tools", () => {
  it("shows distinct accommodation management sections without offering fake hotel reservations", () => {
    render(
      <AccommodationBookingWorkspace
        locale="en"
        venueId="example"
        roomTypes={[
          {
            id: "room-1",
            name: "Sea view double",
            max_guests: 2,
            active: true,
          },
        ]}
        units={[
          { id: "unit-1", name: "101", room_type_id: "room-1", active: true },
        ]}
        rates={[
          {
            id: "rate-1",
            room_type_id: "room-1",
            start_date: "2026-12-01",
            end_date_exclusive: "2026-12-31",
            nightly_price_cents: 12000,
            minimum_nights: 1,
          },
        ]}
        blocks={[
          {
            id: "block-1",
            unit_id: "unit-1",
            start_date: "2026-12-01",
            end_date_exclusive: "2026-12-03",
            reason: "maintenance",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Accommodation sections" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Rooms & units/ }));
    expect(
      screen.getByRole("region", { name: "Rooms & units" }),
    ).toHaveTextContent("Sea view double");
    fireEvent.click(screen.getByText("101"));
    expect(screen.getByDisplayValue("101")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Calendar/ }));
    expect(screen.getByRole("region", { name: "Calendar" })).toHaveTextContent(
      "room nights",
    );
    expect(screen.getByRole("region", { name: "Calendar" })).toHaveTextContent(
      "maintenance",
    );
    expect(screen.getByText(/Overlap protection is verified/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Confirm booking|Book now/ }),
    ).not.toBeInTheDocument();
  });

  it("offers Spanish copy with accessible tab actions", () => {
    render(<AccommodationBookingWorkspace locale="es" venueId="example" />);
    fireEvent.click(screen.getByRole("button", { name: /Tarifas/ }));
    expect(screen.getByRole("region", { name: "Tarifas" })).toHaveTextContent(
      "precios por noche",
    );
  });

  it("renders persisted rate and reservation data without exposing public checkout actions", () => {
    render(
      <AccommodationBookingWorkspace
        locale="en"
        venueId="example"
        roomTypes={[
          { id: "room-1", name: "Apartment", max_guests: 4, active: true },
        ]}
        units={[
          { id: "unit-1", name: "Apt 1", room_type_id: "room-1", active: true },
        ]}
        rates={[
          {
            id: "rate-1",
            room_type_id: "room-1",
            start_date: "2026-12-01",
            end_date_exclusive: "2026-12-31",
            nightly_price_cents: 12500,
            minimum_nights: 2,
          },
        ]}
        reservations={[
          {
            id: "res-1",
            unit_id: "unit-1",
            check_in: "2026-12-10",
            check_out: "2026-12-12",
            guests: 2,
            status: "confirmed",
            contact_name: "Ada Lovelace",
            contact_email: "ada@example.com",
            quoted_total_cents: 25000,
          },
        ]}
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Rates/ }));
    expect(
      screen.getByRole("region", { name: "Rates & rules" }),
    ).toHaveTextContent("€125.00");
    expect(
      screen.queryByRole("button", { name: /Book now/ }),
    ).not.toBeInTheDocument();
  });

  it("shows real booking settings and manager reservation transitions", () => {
    const action = async () => {};
    render(
      <AccommodationBookingWorkspace
        locale="en"
        venueId="00000000-0000-4000-8000-000000000001"
        settings={{
          mode: "request",
          policy: "Pay at the property. Free cancellation before arrival.",
          external_url: null,
          notification_email: "owner@example.com",
        }}
        reservations={[
          {
            id: "00000000-0000-4000-8000-000000000002",
            unit_id: "unit-1",
            check_in: "2027-03-27",
            check_out: "2027-03-29",
            guests: 2,
            status: "requested",
            contact_name: "Alex Guest",
            contact_email: "alex@example.com",
            quoted_total_cents: 27000,
          },
        ]}
        actions={{
          createRoomType: action,
          updateRoomType: action,
          createUnit: action,
          updateUnit: action,
          createRate: action,
          deleteRate: action,
          createBlock: action,
          deleteBlock: action,
          saveSettings: action,
          changeStatus: action,
        }}
      />,
    );
    expect(screen.getByText("Alex Guest")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeVisible();
    expect(screen.getByLabelText("Property summary")).toHaveTextContent(
      "Pending1",
    );
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByRole("radio", { name: "AkiDuermo" })).toBeChecked();
    expect(screen.getByDisplayValue("owner@example.com")).toBeVisible();
  });

  it("keeps accommodation-specific tools and excludes venue-only editors", () => {
    render(
      <VenueDashboard
        locale="en"
        name="Test accommodation"
        product="accommodation"
        status="published"
        verified={true}
        initialSection="events"
        counts={counts}
        sections={{
          profile: <p>Property profile</p>,
          bookings: <p>Stay tools</p>,
          team: <p>Staff</p>,
        }}
      />,
    );
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("tab", { name: /^Events/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^Rewards/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^Check-in/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Bookings/ }));
    expect(screen.getByText("Stay tools")).toBeVisible();
  });

  it("keeps a failed reservation read unknown while other property sections remain usable", () => {
    const action = async () => {};
    render(
      <AccommodationBookingWorkspace
        locale="en"
        venueId="example"
        readErrors={{ reservations: true }}
        actions={{
          createRoomType: action,
          updateRoomType: action,
          createUnit: action,
          updateUnit: action,
          createRate: action,
          deleteRate: action,
          createBlock: action,
          deleteBlock: action,
        }}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Reservations" }),
    ).toHaveTextContent("This section could not be loaded");
    expect(screen.getByLabelText("Property summary")).toHaveTextContent(
      "Occupied—Pending—",
    );
    expect(
      screen.queryByText("No stay reservations yet."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Rooms & units/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("+ New type")).toBeVisible();
  });

  it("does not present an unavailable settings read as paused", () => {
    render(
      <AccommodationBookingWorkspace
        locale="es"
        venueId="example"
        initialTab="settings"
        readErrors={{ settings: true }}
      />,
    );

    expect(screen.getByRole("region", { name: "Ajustes" })).toHaveTextContent(
      "No se pudo cargar esta sección",
    );
    expect(screen.getByLabelText("Resumen del alojamiento")).toHaveTextContent(
      "ReservasNo disponible",
    );
    expect(screen.queryByText("Pausadas")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

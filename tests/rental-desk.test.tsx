// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  RentalOperatorDesk,
  type DeskVehicle,
} from "../src/components/RentalOperatorDesk";
const car: DeskVehicle = {
  id: "v1",
  name: "Mustang",
  category: "premium",
  transmission: "manual",
  fuel: "petrol",
  seats: 2,
  luggage: 2,
  daily_price_cents: 11000,
  deposit_cents: 5000,
  active: true,
};
const actions = {
  create: vi.fn(),
  update: vi.fn(),
  block: vi.fn(),
  booking: vi.fn(),
};
const props = {
  locale: "en" as const,
  company: { id: "c1", name: "Local Cars", status: "published" },
  vehicles: [car],
  bookings: [
    {
      id: "r1",
      vehicle_id: "v1",
      start_date: "2099-01-01",
      end_date: "2099-01-03",
      status: "requested",
      contact_name: "Fixture Renter",
      quoted_total_cents: 22000,
    },
  ],
  blocks: [],
  actions,
};
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("rental desk", () => {
  it("keeps contact data in the requests view and retains action identifiers", () => {
    render(<RentalOperatorDesk {...props} />);
    expect(screen.queryByText("Fixture Renter")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Requests/ }));
    expect(
      screen.getByRole("heading", { name: "Fixture Renter" }),
    ).toBeTruthy();
    const form = screen
      .getByRole("button", { name: "Confirm" })
      .closest("form")!;
    expect(new FormData(form).get("bookingId")).toBe("r1");
    expect(new FormData(form).get("companyId")).toBe("c1");
  });
  it("opens media without burying it below fleet forms", () => {
    render(
      <RentalOperatorDesk
        {...props}
        venueId="venue1"
        mediaStudio={<p>Fixture Media Studio</p>}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Media" }));
    expect(screen.getByText("Fixture Media Studio")).toBeTruthy();
    expect(screen.queryByLabelText("Daily rate (€)")).toBeNull();
  });
  it("opens a dedicated add vehicle form", () => {
    render(<RentalOperatorDesk {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Add car/ }));
    expect(screen.getByLabelText("Model / name")).toBeTruthy();
    expect(screen.getByLabelText("Seats")).toBeTruthy();
  });
});

it("shows every supplied contact field in the pending request view", () => {
  render(
    <RentalOperatorDesk
      {...props}
      bookings={[
        {
          ...props.bookings[0],
          contact_email: "renter@example.test",
          contact_phone: "+34 600 123 456",
          note: "Child seat please",
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Requests/ }));
  expect(
    screen
      .getByRole("link", { name: "renter@example.test" })
      .getAttribute("href"),
  ).toBe("mailto:renter@example.test");
  expect(screen.getByText("+34 600 123 456")).toBeTruthy();
  expect(screen.getByText("Child seat please")).toBeTruthy();
});

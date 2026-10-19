// @vitest-environment jsdom

import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

import { BookingManager } from "../src/components/BookingManager";
import { createClient } from "@supabase/supabase-js";
import {
  loadBookingInbox,
  parseBookingInbox,
  bookingInboxHref,
} from "../src/lib/business-booking-inbox";

afterEach(() => {
  cleanup();
  routerPush.mockReset();
  window.history.replaceState({}, "", "/");
});

const venueId = "00000000-0000-4000-8000-000000000001";
const props = {
  locale: "en" as const,
  venueId,
  settings: { mode: "request", booking_template: "experience" },
  slots: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      starts_at: "2026-11-01T10:00:00Z",
      ends_at: "2026-11-01T11:00:00Z",
      capacity: 2,
      active: true,
      resource_id: "00000000-0000-4000-8000-000000000003",
    },
  ],
  resources: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Buggy 1",
      kind: "vehicle",
      capacity: 2,
      active: true,
    },
  ],
  offerings: [
    {
      id: "00000000-0000-4000-8000-000000000004",
      name: "Buggy tour",
      kind: "experience",
      duration_minutes: 60,
      capacity: 2,
      active: true,
    },
  ],
  requests: [],
  save: vi.fn(async () => {}),
  createSlot: vi.fn(async () => {}),
  createRecurringSlots: vi.fn(async () => {}),
  createResource: vi.fn(async () => {}),
  createOffering: vi.fn(async () => {}),
  updateOffering: vi.fn(async () => {}),
  updateRequest: vi.fn(async () => {}),
};

describe("AkiBusiness advanced booking manager", () => {
  it("shows resources with inventory capacity and a create form", () => {
    render(<BookingManager {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Services" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Manage tables, equipment and staff/,
      }),
    );
    expect(screen.getByText("Bookable resources")).toBeVisible();
    expect(screen.getByText(/Buggy 1/)).toBeVisible();
    expect(screen.getByLabelText("Resource name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add resource" })).toBeVisible();
  });

  it("allows businesses to create offerings", () => {
    render(<BookingManager {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Services" }));
    expect(screen.getByText("Bookable offerings")).toBeVisible();
    expect(screen.getByText(/Buggy tour/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create offering" }),
    ).toBeVisible();
  });

  it("allows businesses to edit existing offerings", () => {
    render(<BookingManager {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Services" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editForm = screen
      .getByRole("button", { name: "Save offering" })
      .closest("form");
    expect(editForm).not.toBeNull();
    const edit = within(editForm as HTMLFormElement);
    expect(screen.getByDisplayValue("Buggy tour")).toBeVisible();
    expect(edit.getByLabelText("Duration (min)")).toHaveValue(60);
    expect(edit.getByLabelText("Maximum capacity")).toHaveValue(2);
    expect(edit.getByLabelText("Type")).toHaveValue("experience");
    expect(
      edit.getByLabelText("Active and visible for new slots"),
    ).toBeChecked();
    expect(screen.getByRole("button", { name: "Save offering" })).toBeVisible();
  });

  it("allows venue owners to choose recurring days and attach a resource", () => {
    render(<BookingManager {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    fireEvent.click(screen.getByText("Schedule recurring availability"));
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("Until (max 90 days)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mon" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sun" })).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Create schedule" }),
    ).toBeVisible();
    expect(screen.getAllByRole("option", { name: "Buggy 1 · 2" })).toHaveLength(
      2,
    );
  });

  it("keeps external mode link-only, without resource or deposit settings", () => {
    render(
      <BookingManager
        {...props}
        settings={{
          mode: "external",
          external_url: "https://example.com/book",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Booking URL")).toHaveValue(
      "https://example.com/book",
    );
    expect(screen.queryByText("Deposit (€)")).not.toBeInTheDocument();
    expect(screen.queryByText("Booking template")).not.toBeInTheDocument();
  });

  it("uses the shared SVG icon system for template selectors", () => {
    const { container } = render(<BookingManager {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Services" }));
    expect(
      container.querySelectorAll(".booking-template-card svg"),
    ).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: "Events & tickets" }),
    ).toBeInTheDocument();
  });
});

describe("bounded booking inbox", () => {
  const requests = Array.from({ length: 20 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    contact_name: `Guest ${i}`,
    contact_email: `guest${i}@example.invalid`,
    party_size: 2,
    status: "requested",
    created_at: "2026-10-09T12:00:00Z",
    slot_id: null,
  }));
  it.each(["en", "es"] as const)(
    "shows a bounded page and preserves %s filters in links/actions",
    (locale) => {
      const { container } = render(
        <BookingManager
          {...props}
          locale={locale}
          requests={requests}
          inbox={{
            search: "Guest",
            status: "requested",
            sort: "oldest",
            page: 2,
            total: 420,
            pending: 280,
          }}
        />,
      );
      expect(container.querySelectorAll(".booking-request-card")).toHaveLength(
        20,
      );
      expect(container.querySelector(".booking-inbox-grid")).toBeVisible();
      expect(screen.getByText("21–40 / 420")).toBeVisible();
      const next = screen.getByRole("link", {
        name: locale === "es" ? "Siguiente" : "Next",
      });
      expect(next.getAttribute("href")).toContain("bookingPage=3");
      expect(next.getAttribute("href")).toContain("bookingSearch=Guest");
      expect(next.getAttribute("href")).toContain("bookingStatus=requested");
      expect(
        container.querySelector(
          '.booking-request-controls input[name="bookingPage"]',
        ),
      ).toHaveValue("2");
      const search = screen.getByRole("search");
      expect(search.getAttribute("method")).toBe("get");
      expect(search.querySelector('input[name="bookingPage"]')).toBeNull();
      expect(screen.getByText("280")).toBeVisible();
    },
  );
  it("applies inbox filters through the app router instead of a full document reload", () => {
    render(
      <BookingManager
        {...props}
        requests={requests.slice(0, 1)}
        inbox={{
          search: "",
          status: "all",
          sort: "newest",
          page: 1,
          total: 1,
          pending: 1,
        }}
      />,
    );
    const searchForm = screen.getByRole("search");
    const search = within(searchForm).getByLabelText("Search bookings");
    fireEvent.change(search, { target: { value: "O'Neill (612)" } });
    fireEvent.change(within(searchForm).getByLabelText("Status"), {
      target: { value: "requested" },
    });
    fireEvent.change(within(searchForm).getByLabelText("Sort"), {
      target: { value: "oldest" },
    });
    fireEvent.submit(searchForm);
    expect(routerPush).toHaveBeenCalledWith(
      expect.stringContaining("bookingSearch=O%27Neill+%28612%29"),
      { scroll: false },
    );
    expect(routerPush.mock.calls[0][0]).toContain("bookingStatus=requested");
    expect(routerPush.mock.calls[0][0]).toContain("bookingSort=oldest");
    expect(routerPush.mock.calls[0][0]).toContain("bookingPage=1");
  });
  it("distinguishes failed reads from empty filtered results", () => {
    const { rerender } = render(
      <BookingManager
        {...props}
        inbox={{
          search: "nobody",
          status: "all",
          sort: "newest",
          page: 1,
          total: 0,
          pending: 0,
          error: true,
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bookings could not be loaded",
    );
    expect(screen.queryByText(/No matching bookings/)).not.toBeInTheDocument();
    rerender(
      <BookingManager
        {...props}
        inbox={{
          search: "nobody",
          status: "all",
          sort: "newest",
          page: 1,
          total: 0,
          pending: 0,
        }}
      />,
    );
    expect(screen.getByText(/No matching bookings/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
  it("shows historic slot dates and details without relying on the calendar array", () => {
    render(
      <BookingManager
        {...props}
        slots={[]}
        requests={[
          {
            ...requests[0],
            contact_phone: "+34000000000",
            notes: "Accessible table",
            venue_availability_slots: {
              starts_at: "2026-11-01T10:00:00Z",
              ends_at: "2026-11-01T11:00:00Z",
            },
          },
        ]}
      />,
    );
    expect(document.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-11-01T10:00:00Z",
    );
    fireEvent.click(screen.getByText("Details & reference"));
    expect(screen.getByText(/Accessible table/)).toBeInTheDocument();
  });
  it("bounds invalid inputs without deleting valid contact punctuation", () => {
    expect(
      parseBookingInbox({ bookingSearch: "O'Neill_guest@example.com" }).search,
    ).toBe("O'Neill_guest@example.com");
    const parsed = parseBookingInbox({
      bookingPage: "Infinity",
      bookingStatus: "unknown",
      bookingSort: "other",
      bookingSearch: 'Álex@example.com%,status.eq.confirmed()"\\',
    });
    expect(parsed).toEqual({
      page: 1,
      status: "all",
      sort: "newest",
      search: 'Álex@example.com%,status.eq.confirmed()"\\',
    });
    expect(parseBookingInbox({ bookingPage: "9999999" }).page).toBe(50000);
    expect(parseBookingInbox({ bookingSearch: "(612) 345-678" }).search).toBe(
      "(612) 345-678",
    );
    expect(
      bookingInboxHref("es", venueId, { ...parsed, search: "a+b@example.com" }),
    ).toContain("a%2Bb%40example.com");
  });
  it("uses the real Supabase client to scope, filter, count and page queries; scopes email reads to visible bookings", async () => {
    const calls: URL[] = [];
    const client = createClient(
      "https://disposable.example.invalid",
      "disposable-key",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: async (input) => {
            const url = new URL(String(input));
            calls.push(url);
            return new Response(
              JSON.stringify(
                url.pathname.endsWith("booking_requests") ? requests : [],
              ),
              {
                status: 200,
                headers: {
                  "content-type": "application/json",
                  "content-range": "20-39/420",
                },
              },
            );
          },
        },
      },
    );
    const result = await loadBookingInbox(client, venueId, {
      search: "Guest_Name@example.com",
      status: "requested",
      sort: "oldest",
      page: 2,
    });
    expect(result.total).toBe(420);
    expect(calls[0].searchParams.get("venue_id")).toBe(`eq.${venueId}`);
    expect(calls[0].searchParams.get("status")).toBe("eq.requested");
    expect(calls[0].searchParams.get("offset")).toBe("20");
    expect(calls[0].searchParams.get("limit")).toBe("20");
    expect(calls[0].searchParams.get("order")).toBe("created_at.asc,id.asc");
    expect(calls[0].searchParams.get("or")).toContain(
      'contact_email.ilike."%Guest\\\\_Name@example.com%"',
    );
    expect(calls[1].searchParams.get("venue_id")).toBe(`eq.${venueId}`);
    expect(calls[1].searchParams.get("booking_id")).toContain(requests[0].id);
    await loadBookingInbox(client, venueId, {
      search: '(612) 345-678, O\'Connor "VIP"',
      status: "all",
      sort: "newest",
      page: 1,
    });
    expect(calls[2].searchParams.get("or")).toContain(
      'contact_phone.ilike."%(612) 345-678, O\'Connor \\"VIP\\"%"',
    );
  });
  it("clamps pages after a filter/action and uses exact reference lookup", async () => {
    const calls: URL[] = [];
    const client = createClient(
      "https://disposable.example.invalid",
      "disposable-key",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: async (input) => {
            const url = new URL(String(input));
            calls.push(url);
            return new Response("[]", {
              status: 200,
              headers: {
                "content-type": "application/json",
                "content-range": "*/0",
              },
            });
          },
        },
      },
    );
    const result = await loadBookingInbox(client, venueId, {
      search: requests[0].id,
      status: "all",
      sort: "newest",
      page: 5,
    });
    expect(result.filters.page).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].searchParams.get("id")).toBe(`eq.${requests[0].id}`);
    expect(calls[0].searchParams.has("or")).toBe(false);
    expect(calls[1].searchParams.get("offset")).toBe("0");
  });
});

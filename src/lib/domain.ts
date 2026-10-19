import type { Locale } from "./config";

export type Translation = { es: string; en?: string };
export type Venue = {
  id: string;
  slug: string;
  name: string;
  description: Translation;
  locality: string;
  address: string;
  latitude: number;
  longitude: number;
  verified: boolean;
  claimStatus?: string;
  discoveryVertical?: "activities" | "accommodation";
  discoveryEnabled?: boolean;
  recommendationWeight?: number;
  chainName?: string;
  accessible: boolean;
  phone?: string;
  whatsappPhone?: string;
  websiteUrl?: string;
  media?: Array<{
    id: string;
    url: string;
    alt: Translation;
  }>;
  logoImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  coverImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  menuImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  eventsImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  exploreImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  offers?: Array<{
    id: string;
    title: Translation;
    terms: Translation;
    startsAt: string;
    endsAt: string;
  }>;
  loyalty?: Array<{
    id: string;
    title: Translation;
    reward: Translation;
    stampsRequired: number;
  }>;
};
export type OccurrenceStatus =
  | "scheduled"
  | "cancelled"
  | "postponed"
  | "sold_out";
export type Occurrence = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: OccurrenceStatus;
  bookingUrl?: string;
};
export type Event = {
  id: string;
  slug: string;
  title: Translation;
  description: Translation;
  venueId: string;
  category: string;
  priceCents: number;
  priceDisplayMode?: "show" | "hide";
  currency: "EUR";
  source: "verified_venue" | "community" | "akipasa_selection";
  location?: {
    latitude: number;
    longitude: number;
    label: string;
    directionsAddress?: string;
  };
  sponsored: boolean;
  bookingUrl?: string;
  minimumAge?: number;
  accessibilityNotes?: Translation;
  bannerImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  exploreImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  profileImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  backgroundImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  mapImage?: {
    id: string;
    url: string;
    alt: Translation;
  };
  occurrences: Occurrence[];
};
export type TimeWindow = "now" | "tonight" | "tomorrow" | "weekend" | "all";
export type DiscoveryQuery = {
  locality?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  time?: TimeWindow;
  dateFrom?: Date;
  dateTo?: Date;
  category?: string;
  price?: "free" | "paid";
  minPriceCents?: number;
  maxPriceCents?: number;
  accessible?: boolean;
  now?: Date;
};
export type DiscoveryResult = {
  event: Event;
  occurrence: Occurrence;
  venue: Venue;
  distanceKm: number;
};

export function translated(value: Translation, locale: Locale): string {
  return value[locale] || value.es;
}

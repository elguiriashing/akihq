import { loadFeatureFlags } from "./feature-flags";
import {
  effectiveVenueRelevance,
  recommendationWeight,
} from "./venue-relevance";
import { config } from "./config";
import { normalizeAddressLabel } from "./maps";
import type { DiscoveryQuery, DiscoveryResult, Event, Venue } from "./domain";
import { fixtureEvents, venues } from "./fixtures";
import { distanceKm } from "./geo";
import { occurrenceMatches } from "./time";
import { isSpainLocation } from "./locations";
import { createSupabasePublicClient } from "./supabase/public";

export interface DiscoveryRepository {
  discover(query: DiscoveryQuery): Promise<DiscoveryResult[]>;
  eventBySlug(slug: string): Promise<Event | null>;
  venueBySlug(slug: string): Promise<Venue | null>;
  venueById(id: string): Promise<Venue | null>;
  eventsForVenue(venueId: string): Promise<Event[]>;
}

export function rankDiscoveryResults(
  results: DiscoveryResult[],
  now = new Date(),
) {
  return [...results].sort((a, b) => {
    const aActive =
      new Date(a.occurrence.startsAt) <= now &&
      new Date(a.occurrence.endsAt) > now;
    const bActive =
      new Date(b.occurrence.startsAt) <= now &&
      new Date(b.occurrence.endsAt) > now;
    return (
      Number(b.event.sponsored) - Number(a.event.sponsored) ||
      Number(bActive) - Number(aActive) ||
      +new Date(a.occurrence.startsAt) - +new Date(b.occurrence.startsAt) ||
      a.distanceKm / recommendationWeight(a.venue.recommendationWeight) -
        b.distanceKm / recommendationWeight(b.venue.recommendationWeight) ||
      a.distanceKm - b.distanceKm
    );
  });
}

export class FixtureRepository implements DiscoveryRepository {
  constructor(private now = new Date()) {}
  async discover(query: DiscoveryQuery) {
    const localityKey = query.locality || "fuengirola";
    const locality = isSpainLocation(localityKey)
      ? config.localities[localityKey]
      : config.localities.fuengirola;
    const center = {
      latitude: Number.isFinite(query.latitude)
        ? query.latitude!
        : locality.latitude,
      longitude: Number.isFinite(query.longitude)
        ? query.longitude!
        : locality.longitude,
    };
    const radius = query.radiusKm || 25;
    const time = query.time || "all";
    const results = fixtureEvents(this.now).flatMap((event) => {
      const venue = venues.find((v) => v.id === event.venueId)!;
      const eventLatitude = event.location?.latitude ?? venue.latitude;
      const eventLongitude = event.location?.longitude ?? venue.longitude;
      const distance = distanceKm(
        center.latitude,
        center.longitude,
        eventLatitude,
        eventLongitude,
      );
      if (
        distance > radius ||
        (query.category && event.category !== query.category) ||
        (query.price === "free" &&
          (event.priceDisplayMode === "hide" || event.priceCents > 0)) ||
        (query.price === "paid" &&
          (event.priceDisplayMode === "hide" || event.priceCents === 0)) ||
        (query.minPriceCents !== undefined &&
          event.priceCents < query.minPriceCents) ||
        (query.maxPriceCents !== undefined &&
          event.priceCents > query.maxPriceCents) ||
        (query.accessible && !venue.accessible)
      )
        return [];
      return event.occurrences
        .filter(
          (o) =>
            o.status === "scheduled" &&
            occurrenceMatches(o.startsAt, o.endsAt, time, this.now) &&
            (!query.dateFrom || new Date(o.endsAt) > query.dateFrom) &&
            (!query.dateTo || new Date(o.startsAt) < query.dateTo),
        )
        .map((occurrence) => ({
          event,
          occurrence,
          venue,
          distanceKm: distance,
        }));
    });
    return rankDiscoveryResults(results, this.now);
  }
  async eventBySlug(slug: string) {
    return fixtureEvents(this.now).find((event) => event.slug === slug) || null;
  }

  async venueBySlug(slug: string) {
    return venues.find((v) => v.slug === slug) || null;
  }
  async venueById(id: string) {
    return venues.find((v) => v.id === id) || null;
  }
  async eventsForVenue(venueId: string) {
    return fixtureEvents(this.now).filter((e) => e.venueId === venueId);
  }
}

type DbPoint =
  | { type?: string; coordinates?: [number, number] }
  | string
  | null;
type DbRecord = Record<string, unknown>;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function one(value: unknown): DbRecord | null {
  if (Array.isArray(value)) return (value[0] as DbRecord | undefined) || null;
  return value && typeof value === "object" ? (value as DbRecord) : null;
}

export function parseDatabasePoint(value: DbPoint) {
  if (value && typeof value === "object" && Array.isArray(value.coordinates)) {
    return {
      longitude: Number(value.coordinates[0]),
      latitude: Number(value.coordinates[1]),
    };
  }
  const match =
    typeof value === "string"
      ? value.match(/POINT\(([-\d.]+) ([-\d.]+)\)/i)
      : null;
  if (match) {
    return { longitude: Number(match[1]), latitude: Number(match[2]) };
  }
  if (
    typeof value === "string" &&
    value.length >= 42 &&
    /^[0-9a-f]+$/i.test(value)
  ) {
    const bytes = Uint8Array.from(value.match(/.{2}/g) || [], (byte) =>
      Number.parseInt(byte, 16),
    );
    const view = new DataView(bytes.buffer);
    const littleEndian = view.getUint8(0) === 1;
    const geometryType = view.getUint32(1, littleEndian);
    const coordinateOffset = geometryType & 0x20000000 ? 9 : 5;
    if (bytes.length >= coordinateOffset + 16) {
      return {
        longitude: view.getFloat64(coordinateOffset, littleEndian),
        latitude: view.getFloat64(coordinateOffset + 8, littleEndian),
      };
    }
  }
  return { longitude: 0, latitude: 0 };
}

function venueFromRow(row: DbRecord): Venue {
  const city = one(row.cities);
  const coordinates = parseDatabasePoint(row.location as DbPoint);
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: {
      es: String(row.description_es || ""),
      en: row.description_en ? String(row.description_en) : undefined,
    },
    locality: String(city?.slug || "fuengirola"),
    address: normalizeAddressLabel(String(row.address)),
    ...coordinates,
    verified: Boolean(row.verified),
    claimStatus: (row.accessibility as { claim_status?: string } | null)
      ?.claim_status,
    discoveryVertical:
      row.discovery_vertical === "accommodation"
        ? "accommodation"
        : "activities",
    discoveryEnabled: row.discovery_enabled !== false,
    recommendationWeight: recommendationWeight(row.recommendation_weight),
    chainName: typeof row.chain_name === "string" ? row.chain_name : undefined,
    accessible: Boolean(
      (row.accessibility as { step_free?: boolean } | null)?.step_free,
    ),
    phone: row.contact_phone ? String(row.contact_phone) : undefined,
    whatsappPhone: row.whatsapp_phone ? String(row.whatsapp_phone) : undefined,
    websiteUrl: row.website_url ? String(row.website_url) : undefined,
  };
}

function eventFromRow(row: DbRecord, now = new Date()): Event | null {
  const category = one(row.categories);
  const occurrences = Array.isArray(row.event_occurrences)
    ? (row.event_occurrences as DbRecord[])
        .map((item) => ({
          id: String(item.id),
          startsAt: String(item.starts_at),
          endsAt: String(item.ends_at),
          status: String(item.status) as Event["occurrences"][number]["status"],
          bookingUrl: item.booking_url ? String(item.booking_url) : undefined,
        }))
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    : [];
  if (!category || !occurrences.length) return null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: {
      es: String(row.title_es),
      en: row.title_en ? String(row.title_en) : undefined,
    },
    description: {
      es: String(row.description_es),
      en: row.description_en ? String(row.description_en) : undefined,
    },
    venueId: String(row.venue_id),
    category: String(category.slug),
    priceCents: Number(row.price_cents || 0),
    priceDisplayMode: row.price_display_mode === "hide" ? "hide" : "show",
    currency: "EUR",
    source:
      row.source === "community"
        ? "community"
        : row.source === "akipasa_selection"
          ? "akipasa_selection"
          : "verified_venue",
    location:
      row.location && row.location_label
        ? {
            ...parseDatabasePoint(row.location as DbPoint),
            label: String(row.location_label),
            directionsAddress: row.directions_address
              ? String(row.directions_address)
              : undefined,
          }
        : undefined,
    sponsored:
      Boolean(row.sponsored) ||
      (Array.isArray(row.feature_slots) &&
        (row.feature_slots as DbRecord[]).some(
          (slot) =>
            new Date(String(slot.starts_at)) <= now &&
            new Date(String(slot.ends_at)) > now,
        )),
    bookingUrl: row.booking_url ? String(row.booking_url) : undefined,
    minimumAge:
      row.minimum_age === null || row.minimum_age === undefined
        ? undefined
        : Number(row.minimum_age),
    accessibilityNotes: row.accessibility_notes_es
      ? {
          es: String(row.accessibility_notes_es),
          en: row.accessibility_notes_en
            ? String(row.accessibility_notes_en)
            : undefined,
        }
      : undefined,
    occurrences,
  };
}

const venueFields =
  "id,slug,name,description_es,description_en,address,location,verified,accessibility,contact_phone,whatsapp_phone,website_url,discovery_vertical,discovery_enabled,recommendation_weight,chain_name,cities(slug)";
const eventFields =
  "id,venue_id,slug,title_es,title_en,description_es,description_en,price_cents,price_display_mode,currency,source,sponsored,booking_url,minimum_age,accessibility_notes_es,accessibility_notes_en,location,location_label,directions_address,categories(slug),event_occurrences!event_occurrences_event_id_fkey(id,starts_at,ends_at,status,booking_url),feature_slots(starts_at,ends_at)";

type PublicVenueMediaRow = {
  id: string;
  storage_path: string;
  alt_es: string | null;
  alt_en: string | null;
};

async function placedVenueMedia(
  supabase: ReturnType<typeof createSupabasePublicClient>,
  venueId: string,
  fallbackMedia: PublicVenueMediaRow[],
) {
  const { data: visualPlacements } = await supabase
    .from("venue_media_placements")
    .select("media_id,placement")
    .eq("venue_id", venueId)
    .eq("target_key", "")
    .in("placement", [
      "venue_profile",
      "venue_cover",
      "venue_menu",
      "venue_events",
      "venue_explore",
    ]);
  const existingIds = new Set(fallbackMedia.map((item) => item.id));
  const missingIds = [
    ...new Set((visualPlacements || []).map((item) => String(item.media_id))),
  ].filter((id) => !existingIds.has(id));
  // Explicit venue placements may refer to event uploads or assets beyond the
  // fallback gallery window, including authorized workspace-shared media.
  // Read only IDs from this venue's public placements; RLS/signing deny access.
  const { data: selectedMedia } = missingIds.length
    ? await supabase
        .from("venue_media")
        .select("id,storage_path,alt_es,alt_en")
        .in("id", missingIds)
    : { data: [] };
  return {
    media: [...fallbackMedia, ...(selectedMedia || [])],
    visualPlacements,
  };
}

async function signVenueMedia(
  supabase: ReturnType<typeof createSupabasePublicClient>,
  media: DbRecord[],
): Promise<NonNullable<Venue["media"]>> {
  const paths = new Set(media.map((item) => String(item.storage_path)));
  if (!paths.size) return [];
  const { data: signedRows } = await supabase.storage
    .from("event-media")
    .createSignedUrls([...paths], 3600);
  const signedUrls = new Map(
    (signedRows || []).flatMap((item) =>
      item.path && paths.has(item.path) && !item.error && item.signedUrl
        ? [[item.path, item.signedUrl] as const]
        : [],
    ),
  );
  // Storage may omit denied assets or return rows in a different order.
  return media.flatMap((item) => {
    const url = signedUrls.get(String(item.storage_path));
    return url
      ? [
          {
            id: String(item.id),
            url,
            alt: {
              es: String(item.alt_es),
              ...(item.alt_en ? { en: String(item.alt_en) } : {}),
            },
          },
        ]
      : [];
  });
}

export class SupabaseDiscoveryRepository implements DiscoveryRepository {
  async discover(query: DiscoveryQuery) {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("events")
      .select(
        `${eventFields},venues(${venueFields},venue_media(id,storage_path,alt_es,alt_en,sort_order))`,
      )
      .eq("status", "published");
    if (error) throw new Error(`Public event query failed: ${error.message}`);
    const flags = await loadFeatureFlags(supabase);
    const localityKey = query.locality || "fuengirola";
    const locality = isSpainLocation(localityKey)
      ? config.localities[localityKey]
      : config.localities.fuengirola;
    const center = {
      latitude: Number.isFinite(query.latitude)
        ? query.latitude!
        : locality.latitude,
      longitude: Number.isFinite(query.longitude)
        ? query.longitude!
        : locality.longitude,
    };
    const radius = query.radiusKm || 25;
    const now = query.now || new Date();

    // Process rows to extract media paths
    const rows = data as unknown as DbRecord[];
    const eventIds = rows.map((row) => String(row.id));
    const venueIds = Array.from(
      new Set(
        rows
          .map((row) => one(row.venues))
          .filter((row): row is DbRecord => Boolean(row))
          .map((row) => String(row.id)),
      ),
    );
    const [{ data: eventVisualPlacements }, { data: venueVisualPlacements }] =
      await Promise.all([
        eventIds.length
          ? supabase
              .from("venue_media_placements")
              .select(
                "target_key,placement,sort_order,media_id,venue_media(id,storage_path,alt_es,alt_en)",
              )
              .in("placement", [
                "event_banner",
                "event_explore",
                "event_profile",
                "event_background",
                "event_map_vertical",
                "event_bin",
              ])
              .in("target_key", eventIds)
              .order("sort_order")
          : Promise.resolve({ data: [] }),
        venueIds.length
          ? supabase
              .from("venue_media_placements")
              .select(
                "venue_id,placement,media_id,venue_media(id,storage_path,alt_es,alt_en)",
              )
              .in("venue_id", venueIds)
              .eq("target_key", "")
              .in("placement", [
                "venue_profile",
                "venue_cover",
                "venue_menu",
                "venue_events",
                "venue_explore",
              ])
          : Promise.resolve({ data: [] }),
      ]);
    const venueVisualRows = new Map<
      string,
      {
        profile?: DbRecord;
        cover?: DbRecord;
        menu?: DbRecord;
        events?: DbRecord;
        explore?: DbRecord;
      }
    >();
    for (const placement of venueVisualPlacements || []) {
      const media = one(placement.venue_media as unknown);
      if (!media) continue;
      const current = venueVisualRows.get(String(placement.venue_id)) || {};
      if (placement.placement === "venue_profile") current.profile = media;
      if (placement.placement === "venue_cover") current.cover = media;
      if (placement.placement === "venue_menu") current.menu = media;
      if (placement.placement === "venue_events") current.events = media;
      if (placement.placement === "venue_explore") current.explore = media;
      venueVisualRows.set(String(placement.venue_id), current);
    }

    const eventVisualRows = new Map<
      string,
      {
        banner?: DbRecord;
        explore?: DbRecord;
        profile?: DbRecord;
        background?: DbRecord;
        mapVertical?: DbRecord;
        bin?: DbRecord[];
      }
    >();
    for (const placement of eventVisualPlacements || []) {
      const media = one(placement.venue_media as unknown);
      if (!media) continue;
      const current = eventVisualRows.get(String(placement.target_key)) || {
        bin: [],
      };
      if (placement.placement === "event_banner") current.banner = media;
      if (placement.placement === "event_explore") current.explore = media;
      if (placement.placement === "event_profile") current.profile = media;
      if (placement.placement === "event_background")
        current.background = media;
      if (placement.placement === "event_map_vertical")
        current.mapVertical = media;
      if (placement.placement === "event_bin") current.bin?.push(media);
      eventVisualRows.set(String(placement.target_key), current);
    }
    const mediaPaths = new Set<string>();
    rows.forEach((row) => {
      const venueRow = one(row.venues);
      if (venueRow && Array.isArray(venueRow.venue_media)) {
        venueRow.venue_media.forEach((m: Record<string, unknown>) => {
          if (m.storage_path) mediaPaths.add(String(m.storage_path));
        });
      }
    });

    for (const visual of eventVisualRows.values()) {
      for (const media of [
        visual.banner,
        visual.explore,
        visual.profile,
        visual.background,
        visual.mapVertical,
        ...(visual.bin || []),
      ]) {
        if (media?.storage_path) mediaPaths.add(String(media.storage_path));
      }
    }
    for (const visual of venueVisualRows.values()) {
      for (const media of [
        visual.profile,
        visual.cover,
        visual.menu,
        visual.events,
        visual.explore,
      ]) {
        if (media?.storage_path) mediaPaths.add(String(media.storage_path));
      }
    }

    // Fetch signed URLs in bulk
    const pathList = Array.from(mediaPaths);
    const signedUrlMap = new Map<string, string>();
    if (pathList.length > 0) {
      const { data: signedData } = await supabase.storage
        .from("event-media")
        .createSignedUrls(pathList, 3600);
      if (signedData) {
        signedData.forEach((item) => {
          if (item.signedUrl && item.path) {
            signedUrlMap.set(item.path, item.signedUrl);
          }
        });
      }
    }

    const results = rows.flatMap((row) => {
      const event = eventFromRow(row);
      const venueRow = one(row.venues);
      if (!event || !venueRow) return [];
      const venue = venueFromRow(venueRow);
      if (event.location) {
        venue.latitude = event.location.latitude;
        venue.longitude = event.location.longitude;
        venue.address = event.location.label;
      }
      Object.assign(
        venue,
        effectiveVenueRelevance(venueRow, flags.venue_relevance),
      );
      if (!venue.discoveryEnabled) return [];

      if (Array.isArray(venueRow.venue_media)) {
        const mappedMedia = [...venueRow.venue_media]
          .filter(
            (item: Record<string, unknown>) =>
              !String(item.storage_path || "").includes("/events/"),
          )
          .sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              Number(a.sort_order || 0) - Number(b.sort_order || 0),
          )
          .map((item: Record<string, unknown>) => {
            const storagePath = String(item.storage_path);
            const url = signedUrlMap.get(storagePath);
            if (!url) return null;
            return {
              id: String(item.id),
              url,
              alt: {
                es: String(item.alt_es),
                ...(item.alt_en ? { en: String(item.alt_en) } : {}),
              },
            };
          })
          .filter(
            (item: unknown): item is NonNullable<typeof item> => item !== null,
          );
        if (mappedMedia.length > 0)
          venue.media = mappedMedia as typeof venue.media;
      }

      const mapVisual = (media: DbRecord | undefined, fallbackAlt: string) => {
        if (!media?.storage_path) return undefined;
        const url = signedUrlMap.get(String(media.storage_path));
        if (!url) return undefined;
        return {
          id: String(media.id),
          url,
          alt: {
            es: String(media.alt_es || fallbackAlt),
            ...(media.alt_en ? { en: String(media.alt_en) } : {}),
          },
        };
      };

      const primaryVenueMedia = venue.media?.[0];
      const venueVisual = venueVisualRows.get(venue.id);
      venue.logoImage =
        mapVisual(venueVisual?.profile, venue.name) || primaryVenueMedia;
      venue.coverImage =
        mapVisual(venueVisual?.cover, venue.name) || primaryVenueMedia;
      venue.menuImage =
        mapVisual(venueVisual?.menu, venue.name) || primaryVenueMedia;
      venue.eventsImage =
        mapVisual(venueVisual?.events, venue.name) || primaryVenueMedia;
      venue.exploreImage =
        mapVisual(venueVisual?.explore, venue.name) || primaryVenueMedia;

      const eventVisual = eventVisualRows.get(event.id);
      const eventBinFallback = eventVisual?.bin?.[0]
        ? mapVisual(eventVisual.bin[0], event.title.es)
        : undefined;
      const eventFallback =
        eventBinFallback || venue.eventsImage || primaryVenueMedia;
      event.bannerImage =
        mapVisual(eventVisual?.banner, event.title.es) || eventFallback;
      event.exploreImage =
        mapVisual(eventVisual?.explore, event.title.es) || eventFallback;
      event.profileImage =
        mapVisual(eventVisual?.profile, event.title.es) || eventFallback;
      event.backgroundImage =
        mapVisual(eventVisual?.background, event.title.es) || eventFallback;
      event.mapImage =
        mapVisual(eventVisual?.mapVertical, event.title.es) || eventFallback;

      if (event.exploreImage) {
        venue.media = [
          event.exploreImage,
          ...(venue.media || []).filter(
            (item) => item.id !== event.exploreImage?.id,
          ),
        ];
      } else if (venue.exploreImage) {
        venue.media = [
          venue.exploreImage,
          ...(venue.media || []).filter(
            (item) => item.id !== venue.exploreImage?.id,
          ),
        ];
      }

      const distance = distanceKm(
        center.latitude,
        center.longitude,
        venue.latitude,
        venue.longitude,
      );
      if (
        distance > radius ||
        (query.category && event.category !== query.category) ||
        (query.price === "free" &&
          (event.priceDisplayMode === "hide" || event.priceCents > 0)) ||
        (query.price === "paid" &&
          (event.priceDisplayMode === "hide" || event.priceCents === 0)) ||
        (query.minPriceCents !== undefined &&
          event.priceCents < query.minPriceCents) ||
        (query.maxPriceCents !== undefined &&
          event.priceCents > query.maxPriceCents) ||
        (query.accessible && !venue.accessible)
      )
        return [];
      return event.occurrences
        .filter(
          (occurrence) =>
            occurrence.status === "scheduled" &&
            occurrenceMatches(
              occurrence.startsAt,
              occurrence.endsAt,
              query.time || "all",
              now,
            ) &&
            (!query.dateFrom || new Date(occurrence.endsAt) > query.dateFrom) &&
            (!query.dateTo || new Date(occurrence.startsAt) < query.dateTo),
        )
        .map((occurrence) => ({
          event,
          occurrence,
          venue,
          distanceKm: distance,
        }));
    });
    return rankDiscoveryResults(results, now);
  }

  async eventBySlug(slug: string) {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("events")
      .select(eventFields)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(`Public event query failed: ${error.message}`);
    const event = data ? eventFromRow(data as unknown as DbRecord) : null;
    if (!event) return null;

    const [{ data: placements }, venue] = await Promise.all([
      supabase
        .from("venue_media_placements")
        .select(
          "media_id,placement,sort_order,venue_media(id,storage_path,alt_es,alt_en)",
        )
        .eq("venue_id", event.venueId)
        .eq("target_key", event.id)
        .in("placement", [
          "event_banner",
          "event_explore",
          "event_profile",
          "event_background",
          "event_map_vertical",
          "event_bin",
        ])
        .order("sort_order"),
      this.venueById(event.venueId),
    ]);

    const placementMedia = (placements || []).flatMap((placement) => {
      const media = one(placement.venue_media as unknown);
      return media
        ? [
            {
              placement: String(placement.placement),
              sortOrder: Number(placement.sort_order || 0),
              media,
            },
          ]
        : [];
    });
    const paths = Array.from(
      new Set(placementMedia.map((item) => String(item.media.storage_path))),
    );
    const { data: signedRows } = paths.length
      ? await supabase.storage.from("event-media").createSignedUrls(paths, 3600)
      : { data: [] };
    const signed = new Map(
      (signedRows || []).flatMap((item) =>
        item.path && item.signedUrl
          ? [[item.path, item.signedUrl] as const]
          : [],
      ),
    );

    const mapPlaced = (placement: string) => {
      const row = placementMedia.find((item) => item.placement === placement);
      if (!row) return undefined;
      const url = signed.get(String(row.media.storage_path));
      if (!url) return undefined;
      return {
        id: String(row.media.id),
        url,
        alt: {
          es: String(row.media.alt_es || event.title.es),
          ...(row.media.alt_en ? { en: String(row.media.alt_en) } : {}),
        },
      };
    };
    const eventBinRows = placementMedia
      .filter((item) => item.placement === "event_bin")
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const eventBinFallback = eventBinRows[0]
      ? (() => {
          const row = eventBinRows[0];
          const url = signed.get(String(row.media.storage_path));
          return url
            ? {
                id: String(row.media.id),
                url,
                alt: {
                  es: String(row.media.alt_es || event.title.es),
                  ...(row.media.alt_en ? { en: String(row.media.alt_en) } : {}),
                },
              }
            : undefined;
        })()
      : undefined;
    const fallback =
      eventBinFallback || venue?.eventsImage || venue?.media?.[0];

    event.bannerImage = mapPlaced("event_banner") || fallback;
    event.exploreImage = mapPlaced("event_explore") || fallback;
    event.profileImage = mapPlaced("event_profile") || fallback;
    event.backgroundImage = mapPlaced("event_background") || fallback;
    event.mapImage = mapPlaced("event_map_vertical") || fallback;
    return event;
  }

  async venueBySlug(slug: string) {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("venues")
      .select(venueFields)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(`Public venue query failed: ${error.message}`);
    if (!data) return null;
    const venue = venueFromRow(data as unknown as DbRecord);
    const [{ data: offers }, { data: loyalty }, { data: media }] =
      await Promise.all([
        supabase
          .from("offers")
          .select("id,title_es,title_en,terms_es,terms_en,starts_at,ends_at")
          .eq("venue_id", venue.id)
          .eq("status", "published")
          .lte("starts_at", new Date().toISOString())
          .gte("ends_at", new Date().toISOString()),
        supabase
          .from("loyalty_programs")
          .select("id,title_es,title_en,reward_es,reward_en,stamps_required")
          .eq("venue_id", venue.id)
          .eq("active", true),
        supabase
          .from("venue_media")
          .select("id,storage_path,alt_es,alt_en")
          .eq("venue_id", venue.id)
          .not("storage_path", "like", "%/events/%")
          .order("sort_order")
          .limit(60),
      ]);
    venue.offers = (offers || []).map((item) => ({
      id: item.id,
      title: { es: item.title_es, en: item.title_en || undefined },
      terms: { es: item.terms_es, en: item.terms_en || undefined },
      startsAt: item.starts_at,
      endsAt: item.ends_at,
    }));
    venue.loyalty = (loyalty || []).map((item) => ({
      id: item.id,
      title: { es: item.title_es, en: item.title_en || undefined },
      reward: { es: item.reward_es, en: item.reward_en || undefined },
      stampsRequired: item.stamps_required,
    }));
    const { media: publicMedia, visualPlacements } = await placedVenueMedia(
      supabase,
      venue.id,
      media || [],
    );
    venue.media = await signVenueMedia(supabase, publicMedia);
    if (venue.media?.length) {
      const primary = venue.media[0];
      const mediaFor = (placement: string) => {
        const mediaId = visualPlacements?.find(
          (item) => item.placement === placement,
        )?.media_id;
        return (
          (mediaId
            ? venue.media?.find((item) => item.id === mediaId)
            : undefined) || primary
        );
      };
      venue.logoImage = mediaFor("venue_profile");
      venue.coverImage = mediaFor("venue_cover");
      venue.menuImage = mediaFor("venue_menu");
      venue.eventsImage = mediaFor("venue_events");
      venue.exploreImage = mediaFor("venue_explore");
      if (venue.coverImage) {
        venue.media = [
          venue.coverImage,
          ...venue.media.filter((item) => item.id !== venue.coverImage?.id),
        ];
      }
    }
    return venue;
  }

  async venueById(id: string) {
    if (!uuidPattern.test(id)) return null;
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("venues")
      .select(venueFields)
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(`Public venue query failed: ${error.message}`);
    const venue = data ? venueFromRow(data as unknown as DbRecord) : null;
    if (!venue) return null;
    const { data: media } = await supabase
      .from("venue_media")
      .select("id,storage_path,alt_es,alt_en")
      .eq("venue_id", venue.id)
      .not("storage_path", "like", "%/events/%")
      .order("sort_order")
      .limit(60);
    const { media: publicMedia, visualPlacements } = await placedVenueMedia(
      supabase,
      venue.id,
      media || [],
    );
    venue.media = await signVenueMedia(supabase, publicMedia);
    if (venue.media?.length) {
      const primary = venue.media[0];
      const mediaFor = (placement: string) => {
        const mediaId = visualPlacements?.find(
          (item) => item.placement === placement,
        )?.media_id;
        return (
          (mediaId
            ? venue.media?.find((item) => item.id === mediaId)
            : undefined) || primary
        );
      };
      venue.logoImage = mediaFor("venue_profile");
      venue.coverImage = mediaFor("venue_cover");
      venue.menuImage = mediaFor("venue_menu");
      venue.eventsImage = mediaFor("venue_events");
      venue.exploreImage = mediaFor("venue_explore");
      if (venue.coverImage) {
        venue.media = [
          venue.coverImage,
          ...venue.media.filter((item) => item.id !== venue.coverImage?.id),
        ];
      }
    }
    return venue;
  }

  async eventsForVenue(venueId: string) {
    if (!uuidPattern.test(venueId)) return [];
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("events")
      .select(eventFields)
      .eq("venue_id", venueId)
      .eq("status", "published");
    if (error) throw new Error(`Public event query failed: ${error.message}`);
    return (data as unknown as DbRecord[])
      .map((row) => eventFromRow(row))
      .filter((event): event is Event => Boolean(event));
  }
}

export class HybridDiscoveryRepository implements DiscoveryRepository {
  constructor(
    private live = new SupabaseDiscoveryRepository(),
    private fallback = new FixtureRepository(),
  ) {}
  async discover(query: DiscoveryQuery) {
    const [live, fallback] = await Promise.all([
      this.live.discover(query).catch(() => []),
      this.fallback.discover(query),
    ]);
    const liveSlugs = new Set(live.map((item) => item.event.slug));
    return rankDiscoveryResults(
      [...live, ...fallback.filter((item) => !liveSlugs.has(item.event.slug))],
      query.now || new Date(),
    );
  }
  async eventBySlug(slug: string) {
    return (
      (await this.live.eventBySlug(slug).catch(() => null)) ||
      this.fallback.eventBySlug(slug)
    );
  }
  async venueBySlug(slug: string) {
    return (
      (await this.live.venueBySlug(slug).catch(() => null)) ||
      this.fallback.venueBySlug(slug)
    );
  }
  async venueById(id: string) {
    return (
      (await this.live.venueById(id).catch(() => null)) ||
      this.fallback.venueById(id)
    );
  }
  async eventsForVenue(venueId: string) {
    const [live, fallback] = await Promise.all([
      this.live.eventsForVenue(venueId).catch(() => []),
      this.fallback.eventsForVenue(venueId),
    ]);
    return [
      ...live,
      ...fallback.filter(
        (item) => !live.some((candidate) => candidate.slug === item.slug),
      ),
    ];
  }
}

// Public browser tests exercise real repository reads against a disposable
// localhost backend. Ordinary fixture builds still use the empty catalogue.
export function usesPublicUiFixtureBackend(
  dataProvider: string,
  privateFlag: string | undefined,
  supabaseUrl: string | undefined,
) {
  if (
    typeof window !== "undefined" ||
    dataProvider !== "fixtures" ||
    privateFlag !== "1" ||
    !supabaseUrl
  )
    return false;
  try {
    const address = new URL(supabaseUrl);
    return (
      address.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(address.hostname) &&
      Boolean(address.port) &&
      Number(address.port) >= 1024 &&
      !address.username &&
      !address.password &&
      address.pathname === "/" &&
      !address.search &&
      !address.hash
    );
  } catch {
    return false;
  }
}

const publicUiFixtureBackend = usesPublicUiFixtureBackend(
  config.dataProvider,
  process.env.AKIPASA_E2E_PUBLIC_UI,
  // Keep the same direct build-time expression as the public Supabase client.
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const repository: DiscoveryRepository =
  config.dataProvider === "fixtures" && !publicUiFixtureBackend
    ? new FixtureRepository()
    : config.dataProvider === "supabase" || publicUiFixtureBackend
      ? new SupabaseDiscoveryRepository()
      : new HybridDiscoveryRepository();

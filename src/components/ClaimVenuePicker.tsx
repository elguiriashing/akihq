"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/config";
import { mapVenueDetailSchema } from "@/lib/map-snapshot";
import {
  createMapGeolocateControl,
  mapGeolocationLocale,
} from "@/lib/map-geolocation";
import { Icon } from "@/components/Icons";

type ClaimVenue = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  locality?: string | null;
  latitude: number;
  longitude: number;
};

export function ClaimVenuePicker({
  locale,
  styleUrl,
  initialVenueId,
}: {
  locale: Locale;
  styleUrl: string;
  initialVenueId?: string;
}) {
  const es = locale === "es";
  const mapRoot = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState<"activities" | "accommodation">(
    "activities",
  );
  const [rows, setRows] = useState<ClaimVenue[]>([]);
  const [selected, setSelected] = useState<ClaimVenue | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!initialVenueId) return;
    const controller = new AbortController();
    fetch(`/api/business/claim-venue/${encodeURIComponent(initialVenueId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const detail = mapVenueDetailSchema.parse(await response.json());
        if (detail.claimStatus !== "unclaimed") return null;
        return detail;
      })
      .then((detail) => {
        if (!detail) return;
        setVertical(detail.discoveryVertical);
        setQuery(detail.name);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [initialVenueId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRows([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/business/claim-search?q=${encodeURIComponent(trimmed)}&vertical=${vertical}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as { rows?: ClaimVenue[] };
        if (!controller.signal.aborted) setRows(data.rows || []);
      } catch {
        if (!controller.signal.aborted) setRows([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, vertical]);

  const chooseVenue = useCallback(
    (venue: ClaimVenue) => {
      setSelected(venue);
      setQuery(venue.name);
      setRows([]);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("view", "claims");
      currentUrl.searchParams.set("venueId", venue.id);
      window.history.replaceState(window.history.state, "", currentUrl);
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({
        center: [venue.longitude, venue.latitude],
        zoom: Math.max(map.getZoom(), 14),
      });
      void import("maplibre-gl").then((maplibregl) => {
        popupRef.current?.remove();
        const node = document.createElement("div");
        node.className = "claim-map-popup";
        const strong = document.createElement("strong");
        strong.textContent = venue.name;
        const small = document.createElement("span");
        small.textContent =
          venue.address ||
          venue.locality ||
          (es ? "Local seleccionado" : "Selected venue");
        node.append(strong, small);
        popupRef.current = new maplibregl.Popup({
          offset: 14,
          closeButton: false,
          maxWidth: "260px",
        })
          .setLngLat([venue.longitude, venue.latitude])
          .setDOMContent(node)
          .addTo(map);
      });
    },
    [es],
  );

  const previewVenue = useCallback(
    (venue: ClaimVenue) => {
      const map = mapRef.current;
      if (!map) return;
      void import("maplibre-gl").then((maplibregl) => {
        popupRef.current?.remove();

        const card = document.createElement("article");
        card.className = "claim-map-popup claim-map-popup-preview";

        const eyebrow = document.createElement("span");
        eyebrow.className = "claim-map-popup-eyebrow";
        eyebrow.textContent = es ? "Local disponible" : "Available venue";

        const title = document.createElement("strong");
        title.textContent = venue.name;

        const address = document.createElement("span");
        address.className = "claim-map-popup-address";
        address.textContent =
          venue.address ||
          venue.locality ||
          (es ? "Sin dirección disponible" : "No address available");

        const action = document.createElement("button");
        action.type = "button";
        action.className = "claim-map-popup-action";
        action.textContent = es ? "Reclamar este local" : "Claim this venue";
        action.addEventListener("click", () => {
          chooseVenue(venue);
        });

        card.append(eyebrow, title, address, action);

        popupRef.current = new maplibregl.Popup({
          offset: 14,
          closeButton: true,
          className: "akibusiness-claim-popup",
          maxWidth: "290px",
        })
          .setLngLat([venue.longitude, venue.latitude])
          .setDOMContent(card)
          .addTo(map);
      });
    },
    [chooseVenue, es],
  );

  useEffect(() => {
    if (!mapRoot.current || !styleUrl) return;
    let disposed = false;
    let cleanup = () => {};

    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !mapRoot.current) return;
      const map = new maplibregl.Map({
        container: mapRoot.current,
        style: {
          version: 8,
          sources: {
            "claim-osm": {
              type: "raster",
              tiles: ["/api/business/map-tile/{z}/{x}/{y}"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "claim-osm",
              type: "raster",
              source: "claim-osm",
            },
          ],
        },
        center: [-4.624, 36.539],
        zoom: 11,
        attributionControl: false,
        locale: mapGeolocationLocale(locale),
        renderWorldCopies: false,
      });
      mapRef.current = map;

      // This map lives inside a responsive split panel. During hydration the
      // panel can briefly report a zero/old size, leaving MapLibre with a
      // zero-sized canvas even though data loads successfully. Keep the map
      // synced to the actual container dimensions.
      const resizeMap = () => {
        if (!disposed) map.resize();
      };
      const resizeObserver = new ResizeObserver(() => resizeMap());
      resizeObserver.observe(mapRoot.current);
      requestAnimationFrame(resizeMap);
      window.setTimeout(resizeMap, 80);
      window.setTimeout(resizeMap, 350);

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.addControl(
        createMapGeolocateControl(maplibregl.GeolocateControl, locale),
        "top-right",
      );

      map.on("load", () => {
        resizeMap();
        setMapReady(true);

        map.addSource("claimable-venues", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 46,
        });
        map.addLayer({
          id: "claimable-clusters",
          type: "circle",
          source: "claimable-venues",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#ffd447",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              16,
              12,
              20,
              40,
              25,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#14213d",
          },
        });
        map.addLayer({
          id: "claimable-cluster-count",
          type: "symbol",
          source: "claimable-venues",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
          },
          paint: { "text-color": "#14213d" },
        });
        map.addLayer({
          id: "claimable-pins",
          type: "circle",
          source: "claimable-venues",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#ffd447",
            "circle-radius": 8,
            "circle-stroke-width": 3,
            "circle-stroke-color": "#14213d",
          },
        });

        async function refresh() {
          const bounds = map.getBounds();
          const params = new URLSearchParams({
            west: String(bounds.getWest()),
            east: String(bounds.getEast()),
            south: String(bounds.getSouth()),
            north: String(bounds.getNorth()),
            vertical,
          });
          try {
            const response = await fetch(`/api/business/claim-map?${params}`, {
              cache: "no-store",
            });
            if (!response.ok) throw new Error("claim map failed");
            const payload = (await response.json()) as {
              rows?: ClaimVenue[];
            };
            const rows = payload.rows || [];
            setVisibleCount(rows.length);
            const source = map.getSource(
              "claimable-venues",
            ) as import("maplibre-gl").GeoJSONSource;
            source.setData({
              type: "FeatureCollection",
              features: rows.map(
                ({
                  id,
                  slug,
                  name,
                  address,
                  locality,
                  longitude,
                  latitude,
                }) => ({
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                  properties: {
                    id,
                    slug,
                    name,
                    address: address || "",
                    locality: locality || "",
                  },
                }),
              ),
            });
            setMapMessage(null);
          } catch {
            setVisibleCount(0);
            setMapMessage(
              es
                ? "No se pudieron cargar los locales de esta zona."
                : "Could not load venues in this area.",
            );
          }
        }

        map.on("moveend", refresh);
        void refresh();

        map.on("click", "claimable-clusters", async (event) => {
          const feature = map.queryRenderedFeatures(event.point, {
            layers: ["claimable-clusters"],
          })[0];
          const clusterId = Number(feature?.properties?.cluster_id);
          if (!Number.isFinite(clusterId)) return;
          const source = map.getSource(
            "claimable-venues",
          ) as import("maplibre-gl").GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          if (!feature || feature.geometry.type !== "Point") return;
          const coords = feature.geometry.coordinates as [number, number];
          map.easeTo({ center: coords, zoom });
        });

        map.on("click", "claimable-pins", (event) => {
          const feature = event.features?.[0];
          const geometry = feature?.geometry;
          const properties = feature?.properties;
          if (!feature || !properties || !geometry || geometry.type !== "Point")
            return;
          const coords = geometry.coordinates as [number, number];
          const venue: ClaimVenue = {
            id: String(properties.id || ""),
            slug: String(properties.slug || ""),
            name: String(properties.name || ""),
            address: properties.address ? String(properties.address) : null,
            locality: properties.locality ? String(properties.locality) : null,
            latitude: coords[1],
            longitude: coords[0],
          };
          if (!venue.id || !venue.name) return;
          previewVenue(venue);
        });

        map.on("mouseenter", "claimable-pins", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "claimable-pins", () => {
          map.getCanvas().style.cursor = "";
        });
      });

      cleanup = () => {
        resizeObserver.disconnect();
        popupRef.current?.remove();
        map.remove();
        mapRef.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [es, locale, previewVenue, styleUrl, vertical]);

  function chooseSearchResult(venue: ClaimVenue) {
    chooseVenue(venue);
  }

  return (
    <div className="claim-venue-picker">
      <input type="hidden" name="venueId" value={selected?.id || ""} required />
      <section className="claim-search-panel">
        <div
          role="group"
          aria-label={es ? "Tipo de negocio" : "Business type"}
          className="claim-vertical-switch"
        >
          {(["activities", "accommodation"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={vertical === value}
              className={vertical === value ? "button" : "button secondary"}
              onClick={() => {
                setVertical(value);
                setSelected(null);
                setRows([]);
              }}
            >
              {value === "activities"
                ? es
                  ? "Locales y eventos"
                  : "Venues & events"
                : es
                  ? "Alojamientos"
                  : "Accommodation"}
            </button>
          ))}
        </div>
        <div className="claim-search-heading">
          <div>
            <span>{es ? "Encuentra tu local" : "Find your venue"}</span>
            <h3>{es ? "Busca o toca el mapa" : "Search or tap the map"}</h3>
          </div>
          {selected && (
            <button type="button" onClick={() => setSelected(null)}>
              {es ? "Cambiar" : "Change"}
            </button>
          )}
        </div>
        <label className="claim-search-input">
          <Icon name="search" />
          <input
            id="claim-venue-search"
            name="claimVenueSearch"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
            placeholder={
              es ? "Nombre, ciudad o dirección..." : "Name, city or address..."
            }
            autoComplete="off"
          />
          {loading && <span aria-hidden="true">…</span>}
        </label>
        {query.trim().length >= 2 && !selected && (
          <div className="claim-search-results">
            {rows.length ? (
              rows.map((venue) => (
                <button
                  type="button"
                  key={venue.id}
                  onClick={() => chooseSearchResult(venue)}
                >
                  <span>
                    <strong>{venue.name}</strong>
                    <small>
                      {[venue.address, venue.locality]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <Icon name="arrow-right" />
                </button>
              ))
            ) : (
              <p>
                {loading
                  ? es
                    ? "Buscando…"
                    : "Searching…"
                  : es
                    ? "No encontramos locales sin reclamar con esa búsqueda."
                    : "No unclaimed venues match that search."}
              </p>
            )}
          </div>
        )}
        {selected && (
          <div className="claim-selected-venue" role="status">
            <span>{es ? "Local seleccionado" : "Selected venue"}</span>
            <strong>{selected.name}</strong>
            <small>{selected.address || selected.locality || ""}</small>
          </div>
        )}
      </section>

      <section className="claim-map-panel">
        <div ref={mapRoot} className="claim-map-canvas" />
        {!mapReady && (
          <div className="claim-map-loading">
            {es ? "Cargando mapa…" : "Loading map…"}
          </div>
        )}
        {mapMessage && <p className="claim-map-message">{mapMessage}</p>}
        <div className="claim-map-legend">
          <i />
          <span>
            {visibleCount > 0
              ? es
                ? `${visibleCount} locales disponibles para reclamar`
                : `${visibleCount} venues available to claim`
              : es
                ? "Locales disponibles para reclamar"
                : "Venues available to claim"}
          </span>
        </div>
      </section>

      {selected && (
        <section className="claim-selected-confirmation" aria-live="polite">
          <div className="claim-selected-confirmation-mark" aria-hidden="true">
            ✓
          </div>
          <div>
            <span>
              {es ? "Vas a reclamar este local" : "You are claiming this venue"}
            </span>
            <strong>{selected.name}</strong>
            <small>{selected.address || selected.locality || ""}</small>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
              popupRef.current?.remove();
              const currentUrl = new URL(window.location.href);
              currentUrl.searchParams.delete("venueId");
              window.history.replaceState(window.history.state, "", currentUrl);
            }}
          >
            {es ? "Cambiar local" : "Change venue"}
          </button>
        </section>
      )}
    </div>
  );
}

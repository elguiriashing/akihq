"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useId, useRef, useState } from "react";
import type { SpainAddressSuggestion } from "@/lib/spain-addresses";

export function OfficialEventLocationPicker({
  locale,
}: {
  locale: "es" | "en";
}) {
  const es = locale === "es";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [directionsAddress, setDirectionsAddress] = useState("");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<SpainAddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const searchId = useId();

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !rootRef.current) return;

      const map = new maplibregl.Map({
        container: rootRef.current,
        style: {
          version: 8,
          sources: {
            "official-event-osm": {
              type: "raster",
              tiles: ["/api/business/map-tile/{z}/{x}/{y}"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "official-event-osm",
              type: "raster",
              source: "official-event-osm",
            },
          ],
        },
        center: [-4.624, 36.539],
        zoom: 12,
        attributionControl: false,
        renderWorldCopies: false,
      });
      mapRef.current = map;

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      const setPoint = (lng: number, lat: number) => {
        setLongitude(lng);
        setLatitude(lat);
        if (!markerRef.current) {
          const marker = new maplibregl.Marker({
            color: "#ffd447",
            draggable: true,
          })
            .setLngLat([lng, lat])
            .addTo(map);
          marker.on("dragend", () => {
            const next = marker.getLngLat();
            setLongitude(next.lng);
            setLatitude(next.lat);
          });
          markerRef.current = marker;
        } else {
          markerRef.current.setLngLat([lng, lat]);
        }
      };

      map.on("click", (event) => {
        setPoint(event.lngLat.lng, event.lngLat.lat);
      });

      map.on("load", () => {
        if (!disposed) {
          setMapReady(true);
          map.resize();
        }
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(rootRef.current);

      requestAnimationFrame(() => map.resize());
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          q: search.trim(),
          mode: "locality",
        });
        const response = await fetch(`/api/locations/search?${params}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("search failed");
        const payload = (await response.json()) as {
          suggestions?: SpainAddressSuggestion[];
        };
        setSuggestions(
          (payload.suggestions || []).filter(
            (item) => item.latitude !== null && item.longitude !== null,
          ),
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
        }
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  function chooseSuggestion(item: SpainAddressSuggestion) {
    setSearch(item.label);
    setSuggestions([]);
    if (item.latitude === null || item.longitude === null) return;
    mapRef.current?.easeTo({
      center: [item.longitude, item.latitude],
      zoom: 14,
      duration: 650,
    });
  }

  const selected = latitude !== null && longitude !== null;

  return (
    <section
      className="official-event-location-picker"
      data-required-ready={selected ? "true" : "false"}
    >
      <div className="official-event-location-copy">
        <span className="eyebrow">
          {es ? "Ubicación del evento" : "Event location"}
        </span>
        <h3>
          {es ? "Coloca el pin donde ocurre" : "Drop the pin where it happens"}
        </h3>
        <p>
          {es
            ? "Busca una zona para acercarte y luego haz clic o toca el mapa. Puedes arrastrar el pin para afinar la posición."
            : "Search an area to get close, then click or tap the map. Drag the pin to fine-tune the position."}
        </p>
      </div>

      <div className="official-event-location-grid">
        <div className="official-event-map-tools">
          <label htmlFor={searchId}>
            {es ? "Buscar zona (opcional)" : "Search area (optional)"}
          </label>
          <div className="official-event-location-search">
            <input
              id={searchId}
              type="search"
              value={search}
              placeholder={
                es ? "Fuengirola, Mijas, Málaga…" : "Fuengirola, Mijas, Málaga…"
              }
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
            />
            {searching && <span aria-hidden="true">…</span>}
          </div>
          {suggestions.length > 0 && (
            <div className="official-event-location-results" role="listbox">
              {suggestions.slice(0, 8).map((item) => (
                <button
                  key={`${item.id}-${item.label}`}
                  type="button"
                  onClick={() => chooseSuggestion(item)}
                >
                  <strong>{item.locality}</strong>
                  <span>{item.province}</span>
                </button>
              ))}
            </div>
          )}

          <label>
            {es ? "Nombre visible del lugar" : "Public place name"}
            <input
              name="locationLabel"
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              maxLength={160}
              required
              placeholder={
                es
                  ? "Ej. Recinto Ferial de Fuengirola"
                  : "e.g. Fuengirola Fairground"
              }
            />
          </label>

          <label>
            {es
              ? "Dirección para indicaciones (Google Maps)"
              : "Directions address (Google Maps)"}
            <input
              name="directionsAddress"
              value={directionsAddress}
              onChange={(event) => setDirectionsAddress(event.target.value)}
              maxLength={300}
              placeholder={
                es
                  ? "Ej. Recinto Ferial, Fuengirola, Málaga"
                  : "e.g. Recinto Ferial, Fuengirola, Málaga"
              }
            />
            <small>
              {es
                ? "Opcional. Si lo dejas vacío, el botón «Cómo llegar» usará directamente las coordenadas del pin."
                : "Optional. If blank, the Directions button will use the pin coordinates directly."}
            </small>
          </label>

          <div
            className={
              selected
                ? "official-event-coordinate-status selected"
                : "official-event-coordinate-status"
            }
            role="status"
          >
            <span aria-hidden="true">{selected ? "✓" : "○"}</span>
            <div>
              <strong>
                {selected
                  ? es
                    ? "Pin colocado"
                    : "Pin placed"
                  : es
                    ? "Falta colocar el pin"
                    : "Place the pin"}
              </strong>
              <small>
                {selected
                  ? `${latitude!.toFixed(6)}, ${longitude!.toFixed(6)}`
                  : es
                    ? "Haz clic o toca el mapa."
                    : "Click or tap the map."}
              </small>
            </div>
          </div>
        </div>

        <div className="official-event-map-wrap">
          <div ref={rootRef} className="official-event-map-canvas" />
          {!mapReady && (
            <div className="official-event-map-loading">
              {es ? "Cargando mapa…" : "Loading map…"}
            </div>
          )}
          <div className="official-event-map-hint">
            {es
              ? "Toca el mapa para colocar el pin"
              : "Tap the map to place the pin"}
          </div>
        </div>
      </div>

      <input
        type="hidden"
        name="latitude"
        value={latitude === null ? "" : latitude}
      />
      <input
        type="hidden"
        name="longitude"
        value={longitude === null ? "" : longitude}
      />
    </section>
  );
}

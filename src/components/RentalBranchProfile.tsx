"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateRentalCompany } from "@/app/[locale]/business/mobility/actions";
import type { SpainAddressSuggestion } from "@/lib/spain-addresses";
import s from "./RentalBranch.module.css";
type Branch = {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  website_url?: string | null;
  description_es?: string;
  description_en?: string | null;
  logo_media_id?: string | null;
  hero_media_id?: string | null;
};
function Save({ es }: { es: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending}>
      {pending ? "…" : es ? "Guardar sucursal" : "Save branch"}
    </button>
  );
}
export function RentalBranchProfile({
  locale,
  company,
  media,
}: {
  locale: "en" | "es";
  company: Branch;
  media: { id: string; alt: string }[];
}) {
  const es = locale === "es",
    node = useRef<HTMLDivElement>(null),
    map = useRef<import("maplibre-gl").Map | null>(null),
    marker = useRef<import("maplibre-gl").Marker | null>(null);
  const [point, setPoint] = useState({
      lat: company.latitude,
      lng: company.longitude,
    }),
    [address, setAddress] = useState(company.address),
    [city, setCity] = useState(company.city),
    [query, setQuery] = useState(""),
    [suggestions, setSuggestions] = useState<SpainAddressSuggestion[]>([]),
    [mapFailed, setMapFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void import("maplibre-gl")
      .then((lib) => {
        if (!alive || !node.current) return;
        try {
          const instance = new lib.Map({
            container: node.current,
            style: {
              version: 8,
              sources: {
                osm: {
                  type: "raster",
                  tiles: ["/api/business/map-tile/{z}/{x}/{y}"],
                  tileSize: 256,
                  attribution: "© OpenStreetMap contributors",
                },
              },
              layers: [{ id: "osm", type: "raster", source: "osm" }],
            },
            center: [company.longitude, company.latitude],
            zoom: 14,
            attributionControl: false,
          });
          map.current = instance;
          const pin = new lib.Marker({ color: "#f04455", draggable: true })
            .setLngLat([company.longitude, company.latitude])
            .addTo(instance);
          marker.current = pin;
          const choose = (lng: number, lat: number) => {
            if (lat < 27 || lat > 44 || lng < -19 || lng > 5) return;
            pin.setLngLat([lng, lat]);
            setPoint({ lat, lng });
          };
          pin.on("dragend", () => {
            const pos = pin.getLngLat();
            choose(pos.lng, pos.lat);
          });
          instance.on("click", (e) => choose(e.lngLat.lng, e.lngLat.lat));
          instance.addControl(
            new lib.NavigationControl({ showCompass: false }),
            "top-right",
          );
          instance.on("load", () => instance.resize());
        } catch {
          setMapFailed(true);
        }
      })
      .catch(() => setMapFailed(true));
    return () => {
      alive = false;
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, [company.latitude, company.longitude]);
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `/api/locations/search?q=${encodeURIComponent(query)}&mode=address`,
        { signal: controller.signal },
      )
        .then((r) => r.json())
        .then((d) => setSuggestions(d.suggestions || []))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const move = (lat: number, lng: number) => {
    setPoint({ lat, lng });
    marker.current?.setLngLat([lng, lat]);
    map.current?.flyTo({ center: [lng, lat], zoom: 16 });
  };
  return (
    <form action={updateRentalCompany} className={s.profile}>
      <input type="hidden" name="companyId" value={company.id} />
      <input type="hidden" name="locale" value={locale} />
      <div className={s.profileFields}>
        <label>
          {es ? "Nombre de la sucursal" : "Branch name"}
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={company.name}
          />
        </label>
        <label>
          {es ? "Presentación en español" : "Spanish introduction"}
          <textarea
            name="description_es"
            maxLength={2000}
            rows={3}
            defaultValue={company.description_es || ""}
          />
        </label>
        <label>
          {es ? "Presentación en inglés" : "English introduction"}
          <textarea
            name="description_en"
            maxLength={2000}
            rows={3}
            defaultValue={company.description_en || ""}
          />
        </label>
        <div className={s.two}>
          <label>
            {es ? "Teléfono de contacto" : "Contact phone"}
            <input
              name="phone"
              type="tel"
              required
              minLength={7}
              maxLength={40}
              defaultValue={company.phone || ""}
            />
          </label>
          <label>
            Web
            <input
              name="website"
              type="url"
              placeholder="https://"
              defaultValue={company.website_url || ""}
            />
          </label>
        </div>
        <div className={s.two}>
          {(["logo_media_id", "hero_media_id"] as const).map((key) => (
            <label key={key}>
              {key === "logo_media_id"
                ? es
                  ? "Logo / perfil"
                  : "Logo / profile"
                : es
                  ? "Portada de la sucursal"
                  : "Branch cover"}
              <select name={key} defaultValue={company[key] || ""}>
                <option value="">{es ? "Sin imagen" : "No image"}</option>
                {media.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alt || m.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p>
          {es
            ? "Las actualizaciones de reservas se envían al email verificado del titular de la sucursal."
            : "Booking updates are sent to the branch owner's verified account email."}
        </p>
        <Save es={es} />
      </div>
      <div className={s.location}>
        <h3>{es ? "Punto de recogida" : "Pick-up location"}</h3>
        <label>
          {es ? "Buscar dirección" : "Search address"}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Calle, ciudad…"
          />
        </label>
        {suggestions.length > 0 && (
          <div className={s.suggestions}>
            {suggestions.slice(0, 5).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  if (item.latitude === null || item.longitude === null) return;
                  move(item.latitude, item.longitude);
                  setAddress(item.address || item.label);
                  setCity(item.locality);
                  setQuery("");
                  setSuggestions([]);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <div
          ref={node}
          className={s.map}
          role="region"
          aria-label={
            es ? "Mapa del punto de recogida" : "Pick-up location map"
          }
        />
        <small>
          {mapFailed
            ? es
              ? "Mapa no disponible. Puedes editar las coordenadas."
              : "Map unavailable. You can edit the coordinates."
            : es
              ? "Toca el mapa o arrastra el pin para afinar la ubicación."
              : "Tap the map or drag the pin to set the location."}
        </small>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
        <label>
          {es ? "Dirección" : "Address"}
          <input
            name="address"
            required
            minLength={4}
            maxLength={240}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <label>
          {es ? "Ciudad" : "City"}
          <input
            name="city"
            required
            minLength={2}
            maxLength={100}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </label>
        <div className={s.two}>
          <label>
            {es ? "Latitud" : "Latitude"}
            <input
              name="latitude"
              type="number"
              step="any"
              min={27}
              max={44}
              required
              value={point.lat}
              onChange={(e) => move(Number(e.target.value), point.lng)}
            />
          </label>
          <label>
            {es ? "Longitud" : "Longitude"}
            <input
              name="longitude"
              type="number"
              step="any"
              min={-19}
              max={5}
              required
              value={point.lng}
              onChange={(e) => move(point.lat, Number(e.target.value))}
            />
          </label>
        </div>
      </div>
    </form>
  );
}

import type { GeolocateControl, Map } from "maplibre-gl";
import type { Locale } from "./config";

export function mapGeolocationLocale(locale: Locale) {
  return {
    "GeolocateControl.FindMyLocation":
      locale === "es" ? "Buscar mi ubicación" : "Find my location",
    "GeolocateControl.LocationNotAvailable":
      locale === "es" ? "Ubicación no disponible" : "Location not available",
  };
}

/** Name the native button while its asynchronous permission check is pending. */
export function createMapGeolocateControl(
  NativeGeolocateControl: typeof GeolocateControl,
  locale: Locale,
) {
  return new (class extends NativeGeolocateControl {
    onAdd(map: Map) {
      const container = super.onAdd(map);
      const button = container.querySelector<HTMLButtonElement>(
        "button.maplibregl-ctrl-geolocate",
      );
      if (button && !button.getAttribute("aria-label") && !button.title) {
        const label =
          mapGeolocationLocale(locale)["GeolocateControl.FindMyLocation"];
        button.title = label;
        button.setAttribute("aria-label", label);
      }
      return container;
    }
  })({
    positionOptions: { enableHighAccuracy: false },
    trackUserLocation: false,
  });
}

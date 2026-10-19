"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SpainAddressSuggestion } from "@/lib/spain-addresses";

type Props = {
  locale: "es" | "en";
  mode: "address" | "locality";
  name?: string;
  label?: string;
  defaultValue?: string;
  required?: boolean;
};

export function SpainAddressAutocomplete({
  locale,
  mode,
  name = mode === "address" ? "address" : "locality",
  label,
  defaultValue = "",
  required = true,
}: Props) {
  const id = useId();
  const listId = `${id}-results`;
  const es = locale === "es";
  const precise = mode === "address";
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<SpainAddressSuggestion[]>([]);
  const [selected, setSelected] = useState<SpainAddressSuggestion | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const interactionStarted = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || !precise) return;
    const restore = (event: Event) => {
      const values = (event as CustomEvent<Record<string, string>>).detail;
      const address = values?.[name];
      const latitude = Number(values?.latitude);
      const longitude = Number(values?.longitude);
      if (
        !address ||
        !values.addressProviderId ||
        !values.locality ||
        !values.province ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      )
        return;
      interactionStarted.current = false;
      setValue(address);
      setSelected({
        id: values.addressProviderId,
        label: address,
        address,
        locality: values.locality,
        province: values.province,
        postalCode: values.postalCode || "",
        latitude,
        longitude,
        kind: "address",
        provider: "cartociudad",
      });
    };
    form.addEventListener("akipasa:restore-contribution-draft", restore);
    return () =>
      form.removeEventListener("akipasa:restore-contribution-draft", restore);
  }, [name, precise]);

  useEffect(() => {
    if (!interactionStarted.current || value.trim().length < 3 || selected) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const params = new URLSearchParams({ q: value.trim(), mode });
        const response = await fetch(`/api/locations/search?${params}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Address search failed");
        const data = (await response.json()) as {
          suggestions?: SpainAddressSuggestion[];
        };
        const next = data.suggestions || [];
        setSuggestions(next);
        setOpen(next.length > 0);
        setActiveIndex(next.length ? 0 : -1);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setFailed(true);
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mode, selected, value]);

  function choose(suggestion: SpainAddressSuggestion) {
    setSelected(suggestion);
    setValue(mode === "address" ? suggestion.address : suggestion.locality);
    setOpen(false);
    setSuggestions([]);
  }

  const status = loading
    ? es
      ? "Buscando direcciones…"
      : "Searching addresses…"
    : failed
      ? es
        ? "La búsqueda no está disponible ahora. Inténtalo de nuevo."
        : "Address search is unavailable right now. Please try again."
      : precise && interactionStarted.current && value && !selected
        ? es
          ? "Selecciona una dirección de la lista para guardar el punto exacto."
          : "Choose an address from the list to save the exact map point."
        : es
          ? "Busca cualquier dirección de España. Datos de CartoCiudad."
          : "Search any address in Spain. Data from CartoCiudad.";

  return (
    <div className="address-autocomplete">
      <label htmlFor={id}>
        {label ||
          (precise
            ? es
              ? "Dirección completa"
              : "Full address"
            : es
              ? "Pueblo o ciudad"
              : "Town or city")}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        required={required}
        minLength={2}
        maxLength={300}
        autoComplete={precise ? "street-address" : "address-level2"}
        placeholder={
          precise
            ? es
              ? "Empieza a escribir calle, número y localidad"
              : "Start typing street, number and town"
            : es
              ? "Empieza a escribir una localidad"
              : "Start typing a town or city"
        }
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
        }
        onChange={(event) => {
          interactionStarted.current = true;
          setValue(event.target.value);
          setSelected(null);
        }}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (!open || !suggestions.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(
              (index) => (index - 1 + suggestions.length) % suggestions.length,
            );
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            choose(suggestions[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {precise && (
        <>
          <input
            type="hidden"
            name="addressSelection"
            value={
              selected
                ? "selected"
                : interactionStarted.current
                  ? ""
                  : defaultValue
                    ? "unchanged"
                    : ""
            }
          />
          <input
            type="hidden"
            name="locality"
            value={selected?.locality || ""}
          />
          <input
            type="hidden"
            name="province"
            value={selected?.province || ""}
          />
          <input
            type="hidden"
            name="postalCode"
            value={selected?.postalCode || ""}
          />
          <input
            type="hidden"
            name="latitude"
            value={selected?.latitude ?? ""}
          />
          <input
            type="hidden"
            name="longitude"
            value={selected?.longitude ?? ""}
          />
          <input
            type="hidden"
            name="addressProviderId"
            value={selected?.id || ""}
          />
        </>
      )}
      {open && (
        <ul id={listId} role="listbox" className="address-results">
          {suggestions.map((suggestion, index) => (
            <li
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              key={`${suggestion.id}-${suggestion.label}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(suggestion)}
            >
              <strong>
                {suggestion.kind === "locality"
                  ? suggestion.locality
                  : suggestion.address}
              </strong>
              <span>
                {suggestion.kind === "locality"
                  ? suggestion.province
                  : `${suggestion.locality} · ${suggestion.province}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <small
        className={
          failed ? "address-status address-status-error" : "address-status"
        }
        aria-live="polite"
      >
        {status}
      </small>
    </div>
  );
}

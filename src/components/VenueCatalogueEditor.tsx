/* eslint-disable @next/next/no-img-element -- Venue media uses native images with existing layout controls. */
"use client";

import { useMemo, useState } from "react";
import {
  blankCatalogueItem,
  euAllergens,
  type AllergenKey,
  type AllergenState,
  type CatalogueItem,
  type CatalogueItemKind,
  type CatalogueLayout,
  type CatalogueText,
  type VenueCatalogueDocument,
} from "@/lib/venue-catalogue";
import {
  saveVenueCatalogue,
  unpublishVenueCatalogue,
} from "@/app/[locale]/business/venue/[id]/actions";

const layouts: Array<[CatalogueLayout, string, string]> = [
  ["menu", "Carta / menú", "Menu"],
  ["cards", "Productos", "Products"],
  ["services", "Servicios", "Services"],
  ["rentals", "Alquileres", "Rentals"],
  ["experiences", "Experiencias", "Experiences"],
];

const kinds: Array<[CatalogueItemKind, string, string]> = [
  ["food", "Comida", "Food"],
  ["drink", "Bebida", "Drink"],
  ["product", "Producto", "Product"],
  ["service", "Servicio", "Service"],
  ["rental", "Alquiler", "Rental"],
  ["experience", "Experiencia", "Experience"],
  ["ticket", "Entrada", "Ticket"],
  ["package", "Paquete", "Package"],
];

const stateOrder: AllergenState[] = [
  "unknown",
  "contains",
  "may_contain",
  "not_in_recipe",
];

function stateLabel(state: AllergenState, es: boolean) {
  return {
    unknown: es ? "Sin revisar" : "Not reviewed",
    contains: es ? "Contiene" : "Contains",
    may_contain: es ? "Puede contener" : "May contain",
    not_in_recipe: es ? "No en receta" : "Not in recipe",
  }[state];
}

function localText(value: { es: string; en: string }, locale: "es" | "en") {
  return value[locale] || value.es || value.en;
}

function kindLabel(kind: CatalogueItemKind, es: boolean) {
  const found = kinds.find(([value]) => value === kind);
  return found ? (es ? found[1] : found[2]) : kind;
}

function formatPrice(item: CatalogueItem, locale: "es" | "en") {
  if (item.priceMode === "on_request" || item.priceCents === null) {
    return locale === "es" ? "Consultar" : "Ask";
  }
  const amount = (item.priceCents / 100).toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
  });
  return item.priceMode === "from"
    ? locale === "es"
      ? "Desde " + amount
      : "From " + amount
    : amount;
}

export function VenueCatalogueEditor({
  locale,
  venueId,
  revision,
  publishedRevision,
  initialDocument,
  mediaOptions = [],
}: {
  locale: "es" | "en";
  venueId: string;
  revision: number;
  publishedRevision: number | null;
  initialDocument: VenueCatalogueDocument;
  mediaOptions?: Array<{ id: string; url: string; alt: string }>;
}) {
  const es = locale === "es";
  const [document, setDocument] = useState(initialDocument);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState(
    initialDocument.sections[0]?.id || "",
  );
  const [selectedItemId, setSelectedItemId] = useState(
    initialDocument.sections[0]?.items[0]?.id || "",
  );
  const [allergenEditorItemId, setAllergenEditorItemId] = useState<
    string | null
  >(null);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(
    () => new Set(initialDocument.sections.map((section) => section.id)),
  );

  const itemCount = useMemo(
    () =>
      document.sections.reduce((sum, section) => sum + section.items.length, 0),
    [document.sections],
  );

  const selectedSection =
    document.sections.find((section) => section.id === selectedSectionId) ||
    document.sections[0] ||
    null;

  const selectedItem =
    selectedSection?.items.find((item) => item.id === selectedItemId) ||
    selectedSection?.items[0] ||
    null;

  function setLocalized(value: CatalogueText, next: string) {
    const { _translation: _staleTranslation, ...copy } = value;
    void _staleTranslation;
    return { ...copy, [locale]: next };
  }

  function updateSectionTitle(sectionId: string, next: string) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? { ...section, title: setLocalized(section.title, next) }
          : section,
      ),
    }));
  }

  function updateItem(sectionId: string, itemId: string, next: CatalogueItem) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? next : item,
              ),
            }
          : section,
      ),
    }));
  }

  function addSection() {
    const id = crypto.randomUUID();
    setDocument((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id,
          title: {
            es: es ? "Nueva sección" : "",
            en: es ? "" : "New section",
          },
          items: [],
        },
      ],
    }));
    setSelectedSectionId(id);
    setSelectedItemId("");
    setExpandedSectionIds((current) => new Set(current).add(id));
  }

  function removeSection(sectionId: string) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== sectionId),
    }));
    const remaining = document.sections.filter(
      (section) => section.id !== sectionId,
    );
    const next = remaining[0];
    setSelectedSectionId(next?.id || "");
    setSelectedItemId(next?.items[0]?.id || "");
    setExpandedSectionIds((current) => {
      const nextIds = new Set(current);
      nextIds.delete(sectionId);
      return nextIds;
    });
  }

  function toggleSectionExpanded(sectionId: string) {
    setExpandedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function addItem(sectionId: string) {
    const item = blankCatalogueItem();
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, item] }
          : section,
      ),
    }));
    setSelectedSectionId(sectionId);
    setSelectedItemId(item.id);
  }

  function removeItem(sectionId: string, itemId: string) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.filter((item) => item.id !== itemId),
            }
          : section,
      ),
    }));
    const section = document.sections.find((item) => item.id === sectionId);
    const remaining = section?.items.filter((item) => item.id !== itemId) || [];
    setSelectedItemId(remaining[0]?.id || "");
  }

  function moveSection(sectionId: string, delta: number) {
    setDocument((current) => {
      const sections = [...current.sections];
      const from = sections.findIndex((section) => section.id === sectionId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= sections.length) return current;
      [sections[from], sections[to]] = [sections[to], sections[from]];
      return { ...current, sections };
    });
  }

  function moveItem(sectionId: string, itemId: string, delta: number) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const items = [...section.items];
        const from = items.findIndex((item) => item.id === itemId);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= items.length) return section;
        [items[from], items[to]] = [items[to], items[from]];
        return { ...section, items };
      }),
    }));
  }

  function cycleAllergen(
    sectionId: string,
    item: CatalogueItem,
    key: AllergenKey,
  ) {
    const current = item.allergens.states[key];
    const next =
      stateOrder[(stateOrder.indexOf(current) + 1) % stateOrder.length];
    updateItem(sectionId, item.id, {
      ...item,
      allergens: {
        ...item.allergens,
        states: { ...item.allergens.states, [key]: next },
        reviewConfirmed: false,
      },
    });
  }

  const foodLike =
    selectedItem &&
    (selectedItem.kind === "food" ||
      selectedItem.kind === "drink" ||
      selectedItem.containsFood);

  const reviewedAllergens = selectedItem
    ? Object.values(selectedItem.allergens.states).filter(
        (state) => state !== "unknown",
      ).length
    : 0;
  const allergenEditorOpen =
    Boolean(selectedItem) && allergenEditorItemId === selectedItem?.id;
  const riskAllergens = selectedItem
    ? euAllergens.filter(([key]) =>
        ["contains", "may_contain"].includes(
          selectedItem.allergens.states[key],
        ),
      )
    : [];
  const visibleRiskAllergens = riskAllergens.slice(0, 5);
  const hiddenRiskAllergenCount = Math.max(
    0,
    riskAllergens.length - visibleRiskAllergens.length,
  );
  const allSectionsExpanded =
    document.sections.length > 0 &&
    document.sections.every((section) => expandedSectionIds.has(section.id));

  return (
    <div className="catalogue-studio">
      <header className="catalogue-studio-header">
        <div>
          <span className="eyebrow">
            {es ? "Catálogo del local" : "Venue catalogue"}
          </span>
          <h2>
            {localText(document.title, locale) ||
              (es
                ? "Carta, productos y servicios"
                : "Menu, products & services")}
          </h2>
          <p>
            {itemCount} {es ? "elementos" : "items"} ·{" "}
            {publishedRevision !== null
              ? es
                ? "Publicado"
                : "Published"
              : es
                ? "Borrador"
                : "Draft"}
          </p>
        </div>
        <div className="catalogue-studio-header-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            {settingsOpen
              ? es
                ? "Cerrar ajustes"
                : "Close settings"
              : es
                ? "Ajustes"
                : "Settings"}
          </button>
          <span className="status-pill">
            {publishedRevision !== null
              ? es
                ? "En vivo"
                : "Live"
              : es
                ? "Sin publicar"
                : "Unpublished"}
          </span>
        </div>
      </header>

      {settingsOpen && (
        <section className="catalogue-studio-settings">
          <label>
            {es ? "Diseño público" : "Public layout"}
            <select
              value={document.layout}
              onChange={(event) =>
                setDocument((current) => ({
                  ...current,
                  layout: event.target.value as CatalogueLayout,
                }))
              }
            >
              {layouts.map(([value, esLabel, enLabel]) => (
                <option key={value} value={value}>
                  {es ? esLabel : enLabel}
                </option>
              ))}
            </select>
          </label>
          <label>
            {es ? "Título" : "Title"}
            <input
              value={localText(document.title, locale)}
              onChange={(event) =>
                setDocument((current) => ({
                  ...current,
                  title: setLocalized(current.title, event.target.value),
                }))
              }
              maxLength={160}
            />
          </label>
          <label className="catalogue-studio-settings-wide">
            {es ? "Descripción" : "Description"}
            <textarea
              rows={2}
              value={localText(document.description, locale)}
              onChange={(event) =>
                setDocument((current) => ({
                  ...current,
                  description: setLocalized(
                    current.description,
                    event.target.value,
                  ),
                }))
              }
              maxLength={1200}
            />
          </label>
        </section>
      )}

      <div className="catalogue-studio-workspace">
        <aside className="catalogue-studio-sidebar">
          <div className="catalogue-studio-sidebar-head">
            <div>
              <strong>{es ? "Secciones" : "Sections"}</strong>
              <span>
                {document.sections.length} {es ? "secciones" : "sections"}
              </span>
            </div>
            <div className="catalogue-sidebar-head-actions">
              <button
                type="button"
                className="catalogue-sidebar-toggle-all"
                onClick={() =>
                  setExpandedSectionIds(
                    allSectionsExpanded
                      ? new Set()
                      : new Set(document.sections.map((section) => section.id)),
                  )
                }
                disabled={document.sections.length === 0}
                aria-label={
                  allSectionsExpanded
                    ? es
                      ? "Contraer todas las secciones"
                      : "Collapse all sections"
                    : es
                      ? "Expandir todas las secciones"
                      : "Expand all sections"
                }
                title={
                  allSectionsExpanded
                    ? es
                      ? "Contraer todo"
                      : "Collapse all"
                    : es
                      ? "Expandir todo"
                      : "Expand all"
                }
              >
                <span aria-hidden="true">
                  {allSectionsExpanded ? "▴" : "▾"}
                </span>
              </button>
              <button
                type="button"
                className="catalogue-sidebar-add-section"
                onClick={addSection}
                aria-label={es ? "Añadir sección" : "Add section"}
                title={es ? "Añadir sección" : "Add section"}
              >
                +
              </button>
            </div>
          </div>

          <div className="catalogue-studio-tree">
            {document.sections.map((section, sectionIndex) => {
              const active = selectedSection?.id === section.id;
              const expanded = expandedSectionIds.has(section.id);
              return (
                <section
                  className={[
                    "catalogue-tree-section",
                    active ? "active" : "",
                    expanded ? "expanded" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={section.id}
                >
                  <button
                    type="button"
                    className="catalogue-tree-section-title"
                    onClick={() => toggleSectionExpanded(section.id)}
                  >
                    <span>
                      <strong>
                        {localText(section.title, locale) ||
                          (es ? "Sin nombre" : "Untitled")}
                      </strong>
                      <small>
                        {section.items.length} {es ? "elementos" : "items"}
                      </small>
                    </span>
                    <b aria-hidden="true">{expanded ? "▾" : "›"}</b>
                  </button>

                  {expanded && (
                    <>
                      <div className="catalogue-tree-section-actions">
                        <button
                          type="button"
                          onClick={() => moveSection(section.id, -1)}
                          disabled={sectionIndex === 0}
                          title={es ? "Subir sección" : "Move section up"}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(section.id, 1)}
                          disabled={
                            sectionIndex === document.sections.length - 1
                          }
                          title={es ? "Bajar sección" : "Move section down"}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSection(section.id)}
                        >
                          {es ? "Eliminar" : "Delete"}
                        </button>
                      </div>

                      <div className="catalogue-tree-items">
                        {section.items.map((item, itemIndex) => {
                          const itemActive = selectedItem?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={
                                itemActive
                                  ? "catalogue-tree-item active"
                                  : "catalogue-tree-item"
                              }
                              onClick={() => {
                                setSelectedSectionId(section.id);
                                setSelectedItemId(item.id);
                              }}
                            >
                              <span className="catalogue-tree-item-index">
                                {itemIndex + 1}
                              </span>
                              <span className="catalogue-tree-item-copy">
                                <strong>
                                  {localText(item.name, locale) ||
                                    (es ? "Nuevo elemento" : "New item")}
                                </strong>
                                <small>
                                  {kindLabel(item.kind, es)} ·{" "}
                                  {formatPrice(item, locale)}
                                </small>
                              </span>
                              <span
                                className={
                                  item.visible
                                    ? "catalogue-tree-visibility on"
                                    : "catalogue-tree-visibility"
                                }
                                title={
                                  item.visible
                                    ? es
                                      ? "Visible"
                                      : "Visible"
                                    : es
                                      ? "Oculto"
                                      : "Hidden"
                                }
                              />
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          className="catalogue-tree-add-item"
                          onClick={() => addItem(section.id)}
                        >
                          + {es ? "Añadir elemento" : "Add item"}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              );
            })}
          </div>

          {!document.sections.length && (
            <div className="catalogue-studio-empty-sidebar">
              <p>
                {es
                  ? "Empieza creando una sección, por ejemplo «Hamburguesas», «Bebidas» o «Alquileres»."
                  : "Start with a section such as “Burgers”, “Drinks” or “Rentals”."}
              </p>
              <button className="button" type="button" onClick={addSection}>
                + {es ? "Crear primera sección" : "Create first section"}
              </button>
            </div>
          )}
        </aside>

        <main className="catalogue-studio-editor">
          {!selectedSection ? (
            <div className="catalogue-studio-empty-editor">
              <span aria-hidden="true">☰</span>
              <h3>
                {es ? "Tu catálogo está vacío" : "Your catalogue is empty"}
              </h3>
              <p>
                {es
                  ? "Crea una sección y añade productos o servicios sin convertir la página en un pergamino infinito."
                  : "Create a section and add products or services without turning the page into an endless scroll."}
              </p>
            </div>
          ) : (
            <>
              <header className="catalogue-studio-section-bar">
                <label>
                  <span>{es ? "Sección" : "Section"}</span>
                  <input
                    value={localText(selectedSection.title, locale)}
                    onChange={(event) =>
                      updateSectionTitle(selectedSection.id, event.target.value)
                    }
                    placeholder={es ? "Ej. Hamburguesas" : "e.g. Burgers"}
                  />
                </label>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => addItem(selectedSection.id)}
                >
                  + {es ? "Nuevo elemento" : "New item"}
                </button>
              </header>

              {!selectedItem ? (
                <div className="catalogue-studio-empty-editor">
                  <span aria-hidden="true">＋</span>
                  <h3>
                    {es ? "Añade el primer elemento" : "Add the first item"}
                  </h3>
                  <p>
                    {es
                      ? "Solo verás la configuración del elemento que estés editando."
                      : "Only the item you are editing will show its configuration."}
                  </p>
                  <button
                    type="button"
                    className="button"
                    onClick={() => addItem(selectedSection.id)}
                  >
                    + {es ? "Añadir elemento" : "Add item"}
                  </button>
                </div>
              ) : (
                <article className="catalogue-item-studio">
                  <header className="catalogue-item-studio-head">
                    <div>
                      <span className="eyebrow">
                        {kindLabel(selectedItem.kind, es)}
                      </span>
                      <h3>
                        {localText(selectedItem.name, locale) ||
                          (es ? "Nuevo elemento" : "New item")}
                      </h3>
                      <p>
                        {formatPrice(selectedItem, locale)} ·{" "}
                        {selectedItem.visible
                          ? es
                            ? "Visible"
                            : "Visible"
                          : es
                            ? "Oculto"
                            : "Hidden"}
                      </p>
                    </div>
                    <div className="catalogue-item-studio-actions">
                      <button
                        type="button"
                        onClick={() =>
                          moveItem(selectedSection.id, selectedItem.id, -1)
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          moveItem(selectedSection.id, selectedItem.id, 1)
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          removeItem(selectedSection.id, selectedItem.id)
                        }
                      >
                        {es ? "Eliminar" : "Delete"}
                      </button>
                    </div>
                  </header>

                  <section className="catalogue-item-studio-panel">
                    <div className="catalogue-item-studio-grid">
                      <label>
                        {es ? "Tipo" : "Type"}
                        <select
                          value={selectedItem.kind}
                          onChange={(event) => {
                            const kind = event.target
                              .value as CatalogueItemKind;
                            updateItem(selectedSection.id, selectedItem.id, {
                              ...selectedItem,
                              kind,
                              containsFood:
                                kind === "food" || kind === "drink"
                                  ? true
                                  : selectedItem.containsFood,
                            });
                          }}
                        >
                          {kinds.map(([value, esLabel, enLabel]) => (
                            <option key={value} value={value}>
                              {es ? esLabel : enLabel}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="catalogue-item-studio-name">
                        {es ? "Nombre" : "Name"}
                        <input
                          value={localText(selectedItem.name, locale)}
                          onChange={(event) =>
                            updateItem(selectedSection.id, selectedItem.id, {
                              ...selectedItem,
                              name: setLocalized(
                                selectedItem.name,
                                event.target.value,
                              ),
                            })
                          }
                          placeholder="Wonder Burger"
                        />
                      </label>

                      <label>
                        {es ? "Precio €" : "Price €"}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={selectedItem.priceMode === "on_request"}
                          value={
                            selectedItem.priceCents === null
                              ? ""
                              : (selectedItem.priceCents / 100).toFixed(2)
                          }
                          onChange={(event) =>
                            updateItem(selectedSection.id, selectedItem.id, {
                              ...selectedItem,
                              priceCents: event.target.value
                                ? Math.round(Number(event.target.value) * 100)
                                : null,
                            })
                          }
                        />
                      </label>

                      <label>
                        {es ? "Precio" : "Pricing"}
                        <select
                          value={selectedItem.priceMode}
                          onChange={(event) =>
                            updateItem(selectedSection.id, selectedItem.id, {
                              ...selectedItem,
                              priceMode: event.target
                                .value as CatalogueItem["priceMode"],
                              priceCents:
                                event.target.value === "on_request"
                                  ? null
                                  : (selectedItem.priceCents ?? 0),
                            })
                          }
                        >
                          <option value="fixed">{es ? "Fijo" : "Fixed"}</option>
                          <option value="from">{es ? "Desde" : "From"}</option>
                          <option value="on_request">
                            {es ? "Consultar" : "On request"}
                          </option>
                        </select>
                      </label>

                      <label>
                        {es ? "Disponibilidad" : "Availability"}
                        <select
                          value={selectedItem.availability}
                          onChange={(event) =>
                            updateItem(selectedSection.id, selectedItem.id, {
                              ...selectedItem,
                              availability: event.target
                                .value as CatalogueItem["availability"],
                            })
                          }
                        >
                          <option value="available">
                            {es ? "Disponible" : "Available"}
                          </option>
                          <option value="sold_out">
                            {es ? "Agotado" : "Sold out"}
                          </option>
                          <option value="seasonal">
                            {es ? "Temporada" : "Seasonal"}
                          </option>
                          <option value="on_request">
                            {es ? "Bajo petición" : "On request"}
                          </option>
                        </select>
                      </label>

                      <label>
                        {es ? "Unidad" : "Unit"}
                        <select
                          value={selectedItem.unit}
                          onChange={(event) =>
                            updateItem(selectedSection.id, selectedItem.id, {
                              ...selectedItem,
                              unit: event.target.value as CatalogueItem["unit"],
                            })
                          }
                        >
                          <option value="each">{es ? "Unidad" : "Each"}</option>
                          <option value="person">
                            {es ? "Persona" : "Person"}
                          </option>
                          <option value="session">
                            {es ? "Sesión" : "Session"}
                          </option>
                          <option value="hour">{es ? "Hora" : "Hour"}</option>
                          <option value="day">{es ? "Día" : "Day"}</option>
                          <option value="night">
                            {es ? "Noche" : "Night"}
                          </option>
                          <option value="month">{es ? "Mes" : "Month"}</option>
                          <option value="kg">kg</option>
                        </select>
                      </label>
                    </div>

                    <label>
                      {es ? "Descripción" : "Description"}
                      <textarea
                        rows={3}
                        value={localText(selectedItem.description, locale)}
                        onChange={(event) =>
                          updateItem(selectedSection.id, selectedItem.id, {
                            ...selectedItem,
                            description: setLocalized(
                              selectedItem.description,
                              event.target.value,
                            ),
                          })
                        }
                        maxLength={1200}
                      />
                    </label>

                    {mediaOptions.length > 0 && (
                      <section className="catalogue-item-media-picker">
                        <div>
                          <strong>
                            {es ? "Imagen del elemento" : "Item image"}
                          </strong>
                          <small>
                            {es
                              ? "Reutiliza una imagen de tu biblioteca."
                              : "Reuse an image from your media library."}
                          </small>
                        </div>
                        <div className="catalogue-item-media-grid">
                          <button
                            type="button"
                            className={!selectedItem.mediaId ? "selected" : ""}
                            onClick={() =>
                              updateItem(selectedSection.id, selectedItem.id, {
                                ...selectedItem,
                                mediaId: null,
                              })
                            }
                          >
                            <span className="catalogue-item-media-empty">
                              ×
                            </span>
                            <small>{es ? "Sin imagen" : "No image"}</small>
                          </button>
                          {mediaOptions.map((media) => (
                            <button
                              type="button"
                              key={media.id}
                              className={
                                selectedItem.mediaId === media.id
                                  ? "selected"
                                  : ""
                              }
                              aria-pressed={selectedItem.mediaId === media.id}
                              onClick={() =>
                                updateItem(
                                  selectedSection.id,
                                  selectedItem.id,
                                  {
                                    ...selectedItem,
                                    mediaId: media.id,
                                  },
                                )
                              }
                            >
                              <img src={media.url} alt={media.alt} />
                              <small>{media.alt}</small>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    <div className="catalogue-item-toggle-row">
                      <label className="catalogue-switch">
                        <input
                          type="checkbox"
                          checked={selectedItem.visible}
                          onChange={(event) =>
                            updateItem(selectedSection.id, selectedItem.id, {
                              ...selectedItem,
                              visible: event.target.checked,
                            })
                          }
                        />
                        <span />
                        <b>{es ? "Visible al público" : "Visible publicly"}</b>
                      </label>

                      {!["food", "drink"].includes(selectedItem.kind) && (
                        <label className="catalogue-switch">
                          <input
                            type="checkbox"
                            checked={selectedItem.containsFood}
                            onChange={(event) =>
                              updateItem(selectedSection.id, selectedItem.id, {
                                ...selectedItem,
                                containsFood: event.target.checked,
                              })
                            }
                          />
                          <span />
                          <b>
                            {es
                              ? "Incluye comida/bebida"
                              : "Contains food/drink"}
                          </b>
                        </label>
                      )}
                    </div>
                  </section>

                  {foodLike && (
                    <section className="catalogue-item-studio-panel allergen-studio">
                      <header className="allergen-studio-head">
                        <div>
                          <span className="eyebrow">
                            {es ? "Seguridad alimentaria" : "Food safety"}
                          </span>
                          <h4>{es ? "Alérgenos UE" : "EU allergens"}</h4>
                          <p>
                            {reviewedAllergens}/14{" "}
                            {es ? "revisados" : "reviewed"}
                          </p>
                        </div>
                        <span
                          className={
                            selectedItem.allergens.reviewConfirmed
                              ? "allergen-review-badge confirmed"
                              : "allergen-review-badge"
                          }
                        >
                          {selectedItem.allergens.reviewConfirmed
                            ? es
                              ? "Revisión confirmada"
                              : "Review confirmed"
                            : es
                              ? "Pendiente"
                              : "Pending"}
                        </span>
                      </header>

                      <div className="allergen-compact-summary">
                        <div className="allergen-summary-copy">
                          <div className="allergen-risk-chips">
                            {riskAllergens.length ? (
                              <>
                                {visibleRiskAllergens.map(
                                  ([key, icon, esLabel, enLabel]) => (
                                    <span
                                      key={key}
                                      data-state={
                                        selectedItem.allergens.states[key]
                                      }
                                    >
                                      <i aria-hidden="true">{icon}</i>
                                      <b>{es ? esLabel : enLabel}</b>
                                    </span>
                                  ),
                                )}
                                {hiddenRiskAllergenCount > 0 && (
                                  <span className="allergen-summary-more">
                                    +{hiddenRiskAllergenCount}{" "}
                                    {es ? "más" : "more"}
                                  </span>
                                )}
                              </>
                            ) : reviewedAllergens === 14 ? (
                              <span className="allergen-summary-clear">
                                ✓{" "}
                                {es
                                  ? "Sin alérgenos marcados como presentes"
                                  : "No allergens marked as present"}
                              </span>
                            ) : (
                              <span className="allergen-summary-pending">
                                {es
                                  ? `${14 - reviewedAllergens} por revisar`
                                  : `${14 - reviewedAllergens} left to review`}
                              </span>
                            )}
                          </div>
                          <small>
                            {es ? "Contaminación cruzada: " : "Cross-contact: "}
                            <strong>
                              {
                                {
                                  unknown: es ? "No evaluada" : "Not assessed",
                                  possible: es ? "Posible" : "Possible",
                                  assessed: es ? "Evaluada" : "Assessed",
                                }[selectedItem.allergens.crossContact]
                              }
                            </strong>
                          </small>
                        </div>
                        <button
                          type="button"
                          className="button secondary allergen-edit-toggle"
                          onClick={() =>
                            setAllergenEditorItemId(
                              allergenEditorOpen ? null : selectedItem.id,
                            )
                          }
                        >
                          {allergenEditorOpen
                            ? es
                              ? "Cerrar edición"
                              : "Close editor"
                            : es
                              ? "Editar alérgenos"
                              : "Edit allergens"}
                        </button>
                      </div>

                      {allergenEditorOpen && (
                        <div className="allergen-editor-drawer">
                          <div className="allergen-toggle-grid compact">
                            {euAllergens.map(
                              ([key, icon, esLabel, enLabel]) => {
                                const state =
                                  selectedItem.allergens.states[key];
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    className="allergen-toggle"
                                    data-state={state}
                                    onClick={() =>
                                      cycleAllergen(
                                        selectedSection.id,
                                        selectedItem,
                                        key,
                                      )
                                    }
                                  >
                                    <span aria-hidden="true">{icon}</span>
                                    <strong>{es ? esLabel : enLabel}</strong>
                                    <small>{stateLabel(state, es)}</small>
                                  </button>
                                );
                              },
                            )}
                          </div>

                          <div className="allergen-studio-tools">
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() =>
                                updateItem(
                                  selectedSection.id,
                                  selectedItem.id,
                                  {
                                    ...selectedItem,
                                    allergens: {
                                      ...selectedItem.allergens,
                                      states: Object.fromEntries(
                                        euAllergens.map(([key]) => [
                                          key,
                                          selectedItem.allergens.states[key] ===
                                          "unknown"
                                            ? "not_in_recipe"
                                            : selectedItem.allergens.states[
                                                key
                                              ],
                                        ]),
                                      ) as CatalogueItem["allergens"]["states"],
                                      reviewConfirmed: false,
                                    },
                                  },
                                )
                              }
                            >
                              {es
                                ? "Completar vacíos como «No en receta»"
                                : "Mark blanks as “Not in recipe”"}
                            </button>
                          </div>

                          {["contains", "may_contain"].includes(
                            selectedItem.allergens.states.gluten,
                          ) && (
                            <fieldset className="allergen-detail-options">
                              <legend>
                                {es ? "Cereales con gluten" : "Gluten cereals"}
                              </legend>
                              {[
                                ["wheat", "Trigo", "Wheat"],
                                ["rye", "Centeno", "Rye"],
                                ["barley", "Cebada", "Barley"],
                                ["oats", "Avena", "Oats"],
                                ["spelt", "Espelta", "Spelt"],
                                ["khorasan", "Khorasan", "Khorasan"],
                              ].map(([key, esLabel, enLabel]) => (
                                <label className="check-row" key={key}>
                                  <input
                                    type="checkbox"
                                    checked={selectedItem.allergens.cereals.includes(
                                      key,
                                    )}
                                    onChange={(event) =>
                                      updateItem(
                                        selectedSection.id,
                                        selectedItem.id,
                                        {
                                          ...selectedItem,
                                          allergens: {
                                            ...selectedItem.allergens,
                                            cereals: event.target.checked
                                              ? [
                                                  ...selectedItem.allergens
                                                    .cereals,
                                                  key,
                                                ]
                                              : selectedItem.allergens.cereals.filter(
                                                  (value) => value !== key,
                                                ),
                                            reviewConfirmed: false,
                                          },
                                        },
                                      )
                                    }
                                  />
                                  {es ? esLabel : enLabel}
                                </label>
                              ))}
                            </fieldset>
                          )}

                          {["contains", "may_contain"].includes(
                            selectedItem.allergens.states.nuts,
                          ) && (
                            <fieldset className="allergen-detail-options">
                              <legend>
                                {es ? "Frutos de cáscara" : "Tree nuts"}
                              </legend>
                              {[
                                ["almond", "Almendra", "Almond"],
                                ["hazelnut", "Avellana", "Hazelnut"],
                                ["walnut", "Nuez", "Walnut"],
                                ["cashew", "Anacardo", "Cashew"],
                                ["pecan", "Pecana", "Pecan"],
                                ["brazil", "Nuez de Brasil", "Brazil nut"],
                                ["pistachio", "Pistacho", "Pistachio"],
                                ["macadamia", "Macadamia", "Macadamia"],
                              ].map(([key, esLabel, enLabel]) => (
                                <label className="check-row" key={key}>
                                  <input
                                    type="checkbox"
                                    checked={selectedItem.allergens.nuts.includes(
                                      key,
                                    )}
                                    onChange={(event) =>
                                      updateItem(
                                        selectedSection.id,
                                        selectedItem.id,
                                        {
                                          ...selectedItem,
                                          allergens: {
                                            ...selectedItem.allergens,
                                            nuts: event.target.checked
                                              ? [
                                                  ...selectedItem.allergens
                                                    .nuts,
                                                  key,
                                                ]
                                              : selectedItem.allergens.nuts.filter(
                                                  (value) => value !== key,
                                                ),
                                            reviewConfirmed: false,
                                          },
                                        },
                                      )
                                    }
                                  />
                                  {es ? esLabel : enLabel}
                                </label>
                              ))}
                            </fieldset>
                          )}

                          <div className="allergen-studio-footer">
                            <label>
                              {es ? "Contaminación cruzada" : "Cross-contact"}
                              <select
                                value={selectedItem.allergens.crossContact}
                                onChange={(event) =>
                                  updateItem(
                                    selectedSection.id,
                                    selectedItem.id,
                                    {
                                      ...selectedItem,
                                      allergens: {
                                        ...selectedItem.allergens,
                                        crossContact: event.target
                                          .value as CatalogueItem["allergens"]["crossContact"],
                                        reviewConfirmed: false,
                                      },
                                    },
                                  )
                                }
                              >
                                <option value="unknown">
                                  {es ? "No evaluada" : "Not assessed"}
                                </option>
                                <option value="possible">
                                  {es ? "Posible" : "Possible"}
                                </option>
                                <option value="assessed">
                                  {es ? "Evaluada" : "Assessed"}
                                </option>
                              </select>
                            </label>

                            <label className="catalogue-review-confirm">
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  selectedItem.allergens.reviewConfirmed,
                                )}
                                onChange={(event) =>
                                  updateItem(
                                    selectedSection.id,
                                    selectedItem.id,
                                    {
                                      ...selectedItem,
                                      allergens: {
                                        ...selectedItem.allergens,
                                        reviewConfirmed: event.target.checked,
                                      },
                                    },
                                  )
                                }
                              />
                              <span>
                                <strong>
                                  {es
                                    ? "He revisado los 14 alérgenos"
                                    : "I reviewed all 14 allergens"}
                                </strong>
                                <small>
                                  {es
                                    ? "Solo tendrás que volver a confirmarlo si cambias la receta o los datos de alérgenos."
                                    : "You only need to reconfirm after changing recipe or allergen data."}
                                </small>
                              </span>
                            </label>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </article>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="catalogue-studio-footer">
        <div>
          <strong>
            {itemCount} {es ? "elementos" : "items"}
          </strong>
          <span>
            {es
              ? "Los cambios no son públicos hasta publicar."
              : "Changes stay private until published."}
          </span>
        </div>
        <div className="catalogue-studio-footer-actions">
          {publishedRevision !== null && (
            <form action={unpublishVenueCatalogue}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="venueId" value={venueId} />
              <input type="hidden" name="expectedRevision" value={revision} />
              <button className="button secondary" type="submit">
                {es ? "Ocultar" : "Unpublish"}
              </button>
            </form>
          )}
          <form action={saveVenueCatalogue}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="venueId" value={venueId} />
            <input type="hidden" name="expectedRevision" value={revision} />
            <input
              type="hidden"
              name="document"
              value={JSON.stringify(document)}
            />
            <button
              className="button secondary"
              type="submit"
              name="publish"
              value="0"
            >
              {es ? "Guardar borrador" : "Save draft"}
            </button>
            <button className="button" type="submit" name="publish" value="1">
              {es ? "Publicar cambios" : "Publish changes"}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

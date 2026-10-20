import { accountTaskFromSearch } from "@/lib/account-task-resume";
import { roleSwapEnabled } from "@/lib/product-roles";
import { notFound } from "next/navigation";
import Link from "next/link";
import { config, isLocale } from "@/lib/config";
import { loadFeatureFlags } from "@/lib/feature-flags";
import { requireUser } from "@/lib/auth";
import { requireManagementHomeAccess } from "@/lib/entitlements";
import {
  confirmRedemption,
  createOfficialEvent,
  createVenue,
  deleteManagedVenue,
  requestPromotion,
  reuseEvent,
  saveLoyaltyProgram,
  submitVenueClaim,
} from "./actions";
import { SpainAddressAutocomplete } from "@/components/SpainAddressAutocomplete";
import { OfficialEventLocationPicker } from "@/components/OfficialEventLocationPicker";
import { PromotionRequestFields } from "@/components/PromotionRequestFields";
import { Icon } from "@/components/Icons";
import { ClaimVenuePicker } from "@/components/ClaimVenuePicker";
import { BusinessHome } from "@/components/BusinessHome";
import { BusinessGrowthOverview } from "@/components/BusinessGrowthOverview";
import { AkiPulseScoped } from "@/components/AkiPulseScoped";
import {
  pulseScopeQuery,
  readPulseScopedReport,
  type PulseScope,
} from "@/lib/akipulse-scoped";
import { AkiPulse } from "@/components/AkiPulse";
import { pulsePeriod, pulseFromEvents } from "@/lib/akipulse";
import {
  WorkspaceShell,
  type WorkspaceItem,
} from "@/components/WorkspaceShell";
import { canModerate } from "@/lib/roles";
import { GuardedActionForm } from "@/components/GuardedActionForm";
import { BusinessEventComposer } from "@/components/BusinessEventComposer";
import { BusinessEventCatalogue } from "@/components/BusinessEventCatalogue";

type ManagedVenue = {
  role: string;
  venues: {
    id: string;
    name: string;
    slug: string;
    status: string;
    verified: boolean;
    discovery_vertical: string | null;
    address?: string | null;
    description_es?: string | null;
    description_en?: string | null;
    phone?: string | null;
    website_url?: string | null;
  } | null;
};

function AutoTranslationNote({ locale }: { locale: "es" | "en" }) {
  const es = locale === "es";
  return (
    <div className="business-translation-assist">
      <Icon name="globe" />
      <span>
        <strong>{es ? "Escribe en español." : "Write in English."}</strong>{" "}
        {es
          ? "AkiPasa creará automáticamente la versión en inglés al guardar."
          : "AkiPasa will automatically create the Spanish version when you save."}
      </span>
    </div>
  );
}

type BusinessEvent = {
  id: string;
  venue_id: string;
  slug: string;
  title_es: string;
  title_en: string | null;
  status: string;
  source: string;
  created_at: string;
  event_occurrences: Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    status: string;
  }>;
};

export default async function BusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const view = [
    "venues",
    "events",
    "loyalty",
    "growth",
    "analytics",
    "pulse",
    "claims",
  ].includes(query.view || "")
    ? query.view!
    : "venues";

  const claimView = view === "claims";
  const returnPath = `/${locale}${accountTaskFromSearch("hq", locale, "/business", { ...query, view }) || "/business"}`;
  const { supabase, user } = claimView
    ? await requireUser(locale, returnPath)
    : await requireManagementHomeAccess(locale, returnPath);
  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .maybeSingle();

  const flags = await loadFeatureFlags(supabase);
  const es = locale === "es";
  const platformStaff = canModerate(profile?.app_role || "");

  const [
    { data: members, error: membersError },
    { data: categories },
    { data: claims },
    { data: programs },
    { data: redemptions },
    { data: promotions },
  ] = await Promise.all([
    supabase
      .from("venue_members")
      .select(
        "role,venues(id,name,slug,status,verified,discovery_vertical,address,description_es,description_en,phone,website_url)",
      )
      .eq("profile_id", user.id),
    supabase.from("categories").select("id,name_es,name_en").order("name_es"),
    supabase
      .from("venue_claims")
      .select("id,status,created_at,venues(name)")
      .eq("claimant_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("loyalty_programs")
      .select(
        "id,venue_id,title_es,title_en,reward_es,reward_en,stamps_required,check_in_token,active",
      ),
    supabase
      .from("reward_redemptions")
      .select(
        "id,requested_at,profiles(display_name),loyalty_programs(title_es,venue_id)",
      )
      .eq("state", "requested")
      .order("requested_at"),
    supabase
      .from("promotion_requests")
      .select("id,venue_id,service,state,created_at")
      .order("created_at", { ascending: false }),
  ]);

  const memberManaged = (members || []) as unknown as ManagedVenue[];
  const { data: editorialVenue } = platformStaff
    ? await supabase
        .from("venues")
        .select("id,name,slug,status,verified,discovery_vertical")
        .eq("slug", "akipasa-editorial")
        .eq("status", "published")
        .maybeSingle()
    : { data: null };
  const managed: ManagedVenue[] = [
    ...memberManaged,
    ...(editorialVenue &&
    !memberManaged.some((item) => item.venues?.id === editorialVenue.id)
      ? [{ role: "editor", venues: editorialVenue }]
      : []),
  ];
  const { data: rentalCompanies, error: rentalCompaniesError } =
    view === "venues"
      ? await supabase.rpc("managed_rental_branches")
      : { data: [], error: null };
  const managedVenueIds = managed.flatMap((item) =>
    item.venues ? [item.venues.id] : [],
  );
  const regularManaged = managed.filter(
    (item) => item.venues?.slug !== "akipasa-editorial",
  );
  const regularVenueIds = regularManaged.flatMap((item) =>
    item.venues ? [item.venues.id] : [],
  );
  const { data: eventComposerMediaRows } =
    view === "events" && regularVenueIds.length
      ? await supabase
          .from("venue_media")
          .select("id,venue_id,storage_path,alt_es,alt_en")
          .in("venue_id", regularVenueIds)
          .order("sort_order")
      : { data: [] };
  const composerMediaPaths = (eventComposerMediaRows || []).map(
    (item) => item.storage_path,
  );
  const { data: composerSignedRows } = composerMediaPaths.length
    ? await supabase.storage
        .from("event-media")
        .createSignedUrls(composerMediaPaths, 3600)
    : { data: [] };
  const composerSignedMap = new Map(
    (composerSignedRows || []).flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );
  const eventComposerMedia = (eventComposerMediaRows || [])
    .filter((item) => !item.storage_path.includes("/events/"))
    .flatMap((item) => {
      const url = composerSignedMap.get(item.storage_path);
      return url
        ? [
            {
              id: item.id,
              venueId: item.venue_id,
              url,
              alt:
                (locale === "es" ? item.alt_es : item.alt_en || item.alt_es) ||
                (es ? "Imagen del local" : "Venue image"),
            },
          ]
        : [];
    });
  const [{ data: promotionEvents }, { data: managedEvents }] =
    managedVenueIds.length
      ? await Promise.all([
          supabase
            .from("events")
            .select("id,venue_id,title_es,title_en")
            .in("venue_id", managedVenueIds)
            .eq("status", "published")
            .order("title_es"),
          supabase
            .from("events")
            .select(
              "id,venue_id,slug,title_es,title_en,status,source,created_at,event_occurrences!event_occurrences_event_id_fkey(id,starts_at,ends_at,status)",
            )
            .in("venue_id", managedVenueIds)
            .order("created_at", { ascending: false }),
        ])
      : [{ data: [] }, { data: [] }];
  const businessEvents = (managedEvents || []) as unknown as BusinessEvent[];
  const venueNames = new Map(
    managed.flatMap((item) =>
      item.venues ? [[item.venues.id, item.venues.name] as const] : [],
    ),
  );
  const now = Date.now();
  const archivedEvents = businessEvents.filter(
    (event) => event.status === "archived",
  );
  const pastEvents = businessEvents.filter(
    (event) =>
      event.status !== "archived" &&
      event.event_occurrences.length > 0 &&
      event.event_occurrences.every(
        (occurrence) => new Date(occurrence.ends_at).getTime() < now,
      ),
  );
  const pulseEnabled = process.env.AKIPULSE_ENABLED === "true";
  const pulseView = ["pulse", "growth", "analytics"].includes(view);
  const days = pulsePeriod(query.days);
  const availableLocations = managed.flatMap((item) =>
    item.venues ? [item.venues] : [],
  );
  // Never use the query parameter to broaden the membership-derived resource set.
  const selectedLocation = availableLocations.some(
    (item) => item.id === query.location,
  )
    ? query.location!
    : "all";
  const scopedLocations = availableLocations.filter(
    (item) => selectedLocation === "all" || item.id === selectedLocation,
  );
  const periodEnd = new Date();
  const scopedPulseEnabled =
    pulseEnabled &&
    pulseView &&
    process.env.AKIPULSE_SCOPED_BOOKINGS_READY === "true";
  const scopedPulseQuery = pulseScopeQuery.parse(query);
  const scopeList = scopedPulseEnabled
    ? await supabase.rpc("akipulse_scopes", {
        p_kind: scopedPulseQuery.pulseKind,
        p_limit: 51,
        p_offset: scopedPulseQuery.pulsePage * 50,
      })
    : { data: [], error: null };
  const pulseScopes: PulseScope[] = (scopeList.data || []).slice(0, 50);
  // A selection is never a permission grant: the aggregate RPC rechecks all underlying scopes.
  const pulseResource =
    scopedPulseQuery.pulseResource || pulseScopes[0]?.id || "";
  const scopeResult =
    scopedPulseEnabled && pulseResource && !scopeList.error
      ? await supabase.rpc("akipulse_scope_analytics", {
          p_kind: scopedPulseQuery.pulseKind,
          p_id: pulseResource,
          p_days: days,
          p_until: periodEnd.toISOString(),
        })
      : { data: null, error: null };
  const scopedPulseReport = scopeResult.data
    ? readPulseScopedReport(
        scopeResult.data,
        scopedPulseQuery.pulseKind,
        pulseResource,
        days,
        periodEnd.toISOString(),
      )
    : null;

  const analytics = pulseView
    ? await Promise.all(
        (pulseEnabled ? scopedLocations.slice(0, 20) : scopedLocations).map(
          async (venue) => {
            if (!pulseEnabled) {
              const { data, error } = await supabase.rpc("venue_analytics", {
                p_venue: venue.id,
              });
              return {
                ...venue,
                events: businessEvents.filter(
                  (event) => event.venue_id === venue.id,
                ).length,
                metrics: error
                  ? null
                  : ((data || []) as { action: string; total: number }[]).map(
                      (row) => ({
                        action: row.action,
                        current: Number(row.total),
                        previous: 0,
                      }),
                    ),
              };
            }
            const since = new Date(
              periodEnd.getTime() - days * 2 * 86400000,
            ).toISOString();
            // RLS remains authoritative. Exact count detects provider response truncation.
            // Indexed venue/time range, at most 1,000 returned rows per selected location.
            const { data, error, count } = await supabase
              .from("analytics_events")
              .select("action,occurred_at", { count: "exact" })
              .eq("venue_id", venue.id)
              .gte("occurred_at", since)
              .lt("occurred_at", periodEnd.toISOString())
              .order("occurred_at")
              .limit(1000);
            return {
              ...venue,
              events: businessEvents.filter(
                (event) => event.venue_id === venue.id,
              ).length,
              metrics:
                error || count === null || count !== data?.length
                  ? null
                  : pulseFromEvents(data || [], days, periodEnd.getTime()),
            };
          },
        ),
      )
    : [];

  const base = `/${locale}/business`;
  const items: WorkspaceItem[] = [
    {
      href: base,
      label: es ? "Inicio" : "Home",
      icon: "home",
      count: managed.length || undefined,
    },
    {
      href: `${base}?view=events`,
      label: es ? "Eventos" : "Events",
      icon: "calendar",
      count: businessEvents.length || undefined,
    },
    {
      href: `${base}?view=loyalty`,
      label: es ? "Fidelidad" : "Loyalty",
      icon: "gift",
      count: redemptions?.length || undefined,
    },
    {
      href: `${base}?view=pulse`,
      label: pulseEnabled ? "AkiPulse" : es ? "Actividad" : "Activity",
      icon: "activity",
    },
    {
      href: `/${locale}/account/subscription?from=akibusiness`,
      label: es ? "Membresías" : "Memberships",
      icon: "settings",
    },

    {
      href: `${base}?view=claims`,
      label: es ? "Reclamar" : "Claims",
      icon: "inbox",
      count: claims?.length || undefined,
    },
  ];

  return (
    <WorkspaceShell
      title={es ? "Tu negocio, a mano" : "Your business, at a glance"}
      eyebrow={es ? "Panel de negocio" : "Business workspace"}
      description={
        es
          ? "Gestiona tus locales, fidelidad y crecimiento desde un solo espacio."
          : "Manage venues, loyalty, and growth from one focused workspace."
      }
      homeHref={base}
      items={items}
      navigationTitle={es ? "Negocio" : "Business"}
    >
      {(query.created || query.error) && (
        <p
          className={`notice ${query.created ? "notice-success" : "notice-error"}`}
        >
          {query.created
            ? ["venue", "event"].includes(query.created)
              ? es
                ? "✓ Guardado correctamente. Pendiente de revisión."
                : "✓ Saved successfully. Waiting for review."
              : es
                ? "✓ Guardado correctamente."
                : "✓ Saved successfully."
            : query.error === "claim-validation"
              ? es
                ? "Revisa el nombre, la relación con el negocio y las pruebas antes de enviar la reclamación."
                : "Check your name, business role and supporting evidence before submitting the claim."
              : es
                ? "✕ No se pudo guardar. Revisa los campos o permisos."
                : "✕ Could not save. Check the fields or permissions."}
        </p>
      )}
      <section className="dashboard-grid">
        {view === "events" && query.compose !== "1" && (
          <section className="panel catalogue-edit-card dashboard-grid-full">
            <BusinessEventCatalogue
              locale={locale}
              reuseAction={reuseEvent}
              events={businessEvents.map((event) => {
                const occurrences = [...event.event_occurrences].sort(
                  (a, b) =>
                    new Date(a.starts_at).getTime() -
                    new Date(b.starts_at).getTime(),
                );
                const reference =
                  occurrences.find(
                    (occurrence) =>
                      new Date(occurrence.ends_at).getTime() >= now,
                  ) || occurrences.at(-1);
                return {
                  id: event.id,
                  venueId: event.venue_id,
                  slug: event.slug,
                  title:
                    locale === "en"
                      ? event.title_en || event.title_es
                      : event.title_es,
                  venue:
                    event.source === "akipasa_selection"
                      ? "Selección AkiPasa"
                      : venueNames.get(event.venue_id) ||
                        (es ? "Local" : "Venue"),
                  status: event.status,
                  group: (archivedEvents.includes(event)
                    ? "archived"
                    : pastEvents.includes(event)
                      ? "past"
                      : "current") as "archived" | "past" | "current",
                  date: reference?.starts_at || null,
                };
              })}
            />
          </section>
        )}

        {roleSwapEnabled && view === "venues" && (
          <p>
            <Link href={`/${locale}/business/locations`}>
              {es
                ? "Gestionar ubicaciones privadas"
                : "Manage private operating locations"}
            </Link>
          </p>
        )}
        {view === "venues" &&
          process.env.AKISUITE_ACCOMMODATION_READY === "true" && (
            <p>
              <Link href={`/${locale}/business/accommodations`}>
                {es
                  ? "Gestionar alojamientos independientes"
                  : "Manage independent accommodation"}
              </Link>
            </p>
          )}
        {view === "venues" && (
          <BusinessHome
            locale={locale}
            readError={Boolean(membersError || rentalCompaniesError)}
            places={[
              ...managed.flatMap((item) =>
                item.venues
                  ? [
                      {
                        id: item.venues.id,
                        name: item.venues.name,
                        slug: item.venues.slug,
                        status: item.venues.status,
                        role: item.role,
                        product:
                          item.venues.discovery_vertical === "accommodation"
                            ? ("stay" as const)
                            : ("venue" as const),
                      },
                    ]
                  : [],
              ),
              ...(rentalCompanies || []).map(
                (company: {
                  id: string;
                  name: string;
                  slug: string;
                  status: string;
                  submitted_by: string;
                }) => ({
                  id: company.id,
                  name: company.name,
                  slug: company.slug,
                  status: company.status,
                  role: company.submitted_by === user.id ? "owner" : "manager",
                  product: "rental" as const,
                }),
              ),
            ]}
            deleteAction={deleteManagedVenue}
          />
        )}

        {/* Create Venue Form */}
        {view === "venues" && (
          <details className="panel catalogue-edit-card" open={!managed.length}>
            <summary>
              <strong>
                {es ? "+ Crear un nuevo local" : "+ Create a new venue"}
              </strong>
            </summary>

            <AutoTranslationNote locale={locale} />
            <form action={createVenue} className="stack focused-form">
              <input type="hidden" name="locale" value={locale} />

              <div className="form-grid-two">
                <label>
                  {es ? "Nombre del local" : "Venue name"}
                  <input
                    name="name"
                    required
                    minLength={2}
                    placeholder="Ej. El Asador"
                  />
                </label>
              </div>

              <div className="form-grid-two">
                <SpainAddressAutocomplete locale={locale} mode="address" />
              </div>
              <p className="fine-print">
                {es
                  ? "AkiPasa creará automáticamente la dirección web de tu local."
                  : "AkiPasa will create your venue’s web address automatically."}
              </p>

              <div className="form-grid-two">
                <label>
                  {es ? "Descripción" : "Description"}
                  <textarea
                    name="description"
                    required
                    minLength={20}
                    rows={3}
                  />
                </label>
              </div>

              <div className="form-actions-right">
                <p className="fine-print form-action-note">
                  {es
                    ? "Podrás añadir imágenes una vez creado."
                    : "You can add images after creation."}
                </p>
                <button className="button primary" type="submit">
                  {es
                    ? "Crear y enviar a revisión"
                    : "Create and submit for review"}
                </button>
              </div>
            </form>
          </details>
        )}

        {view === "events" && platformStaff && query.compose !== "1" && (
          <details
            id="create-official-event"
            className="panel catalogue-edit-card dashboard-grid-full"
            open
          >
            <summary>
              <strong>
                {es
                  ? "+ Publicar Selección AkiPasa"
                  : "+ Publish AkiPasa Selection"}
              </strong>
            </summary>
            <div className="catalogue-section-header">
              <div>
                <span className="eyebrow">Selección AkiPasa</span>
                <h2>
                  {es
                    ? "Ferias, romerías y planes de interés público"
                    : "Fairs, festivals and public-interest plans"}
                </h2>
                <p className="catalogue-section-sub">
                  {es
                    ? "Se publica desde el perfil editorial de AkiPasa y aparece con marcador oficial. «Selección AkiPasa» significa seleccionado/publicado por AkiPasa, no necesariamente organizado por AkiPasa."
                    : "Published from AkiPasa's editorial profile with an official marker. “AkiPasa Selection” means curated/published by AkiPasa, not necessarily organised by AkiPasa."}
                </p>
              </div>
            </div>
            <AutoTranslationNote locale={locale} />
            <GuardedActionForm
              action={createOfficialEvent}
              className="stack focused-form"
            >
              <input type="hidden" name="locale" value={locale} />
              <div className="form-grid-two">
                <label>
                  {es ? "Categoría" : "Category"}
                  <select name="categoryId" required>
                    {categories?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {locale === "es" ? category.name_es : category.name_en}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {es ? "Título" : "Title"}
                  <input
                    name="title"
                    required
                    minLength={3}
                    maxLength={160}
                    placeholder={
                      es ? "Ej. Feria de Fuengirola" : "e.g. Fuengirola Fair"
                    }
                  />
                </label>
              </div>
              <OfficialEventLocationPicker locale={locale} />
              <label>
                {es ? "Descripción" : "Description"}
                <textarea
                  name="description"
                  required
                  minLength={20}
                  maxLength={4000}
                  rows={4}
                />
              </label>
              <fieldset className="official-event-price-fieldset">
                <legend>{es ? "Precio de entrada" : "Entry price"}</legend>
                <div className="event-price-mode">
                  <label className="event-price-option">
                    <input
                      type="radio"
                      name="priceDisplayMode"
                      value="hide"
                      defaultChecked
                    />
                    <span>◌</span>
                    <strong>{es ? "No mostrar precio" : "Hide price"}</strong>
                    <small>
                      {es
                        ? "Para planes sin entrada: desayunos, mercados, bares…"
                        : "For events with no entry fee: breakfasts, markets, bars…"}
                    </small>
                  </label>
                  <label className="event-price-option">
                    <input type="radio" name="priceDisplayMode" value="show" />
                    <span>€</span>
                    <strong>{es ? "Mostrar precio" : "Show price"}</strong>
                    <small>
                      {es
                        ? "0 € aparecerá como Gratis."
                        : "€0 displays as Free."}
                    </small>
                  </label>
                </div>
                <label className="event-price-input">
                  {es ? "Precio (€)" : "Price (€)"}
                  <input
                    name="priceEuros"
                    type="number"
                    min="0"
                    defaultValue="0"
                    step="0.01"
                    required
                  />
                </label>
              </fieldset>
              <label>
                {es ? "Enlace oficial / reserva" : "Official / booking link"}
                <input name="bookingUrl" type="url" placeholder="https://" />
              </label>
              <div className="form-grid-two">
                <label>
                  {es ? "Inicio" : "Starts"}
                  <input name="startsAt" type="datetime-local" required />
                </label>
                <label>
                  {es ? "Fin" : "Ends"}
                  <input name="endsAt" type="datetime-local" required />
                </label>
              </div>
              <div className="form-actions-right">
                <button className="button primary" type="submit">
                  {es
                    ? "Publicar Selección AkiPasa"
                    : "Publish AkiPasa Selection"}
                </button>
              </div>
            </GuardedActionForm>
          </details>
        )}

        {/* Create Event Form */}
        {view === "events" && regularManaged.length > 0 && (
          <details
            id="create-event"
            className="panel catalogue-edit-card dashboard-grid-full"
            open={query.compose === "1"}
          >
            <summary>
              <strong>
                {es ? "+ Crear evento de local" : "+ Create venue event"}
              </strong>
            </summary>
            <BusinessEventComposer
              locale={locale}
              venues={regularManaged.flatMap((item) =>
                item.venues
                  ? [{ id: item.venues.id, name: item.venues.name }]
                  : [],
              )}
              categories={(categories || []).map((category) => ({
                id: category.id,
                label:
                  (locale === "es" ? category.name_es : category.name_en) ||
                  category.name_es,
              }))}
              media={eventComposerMedia}
            />
          </details>
        )}

        {/* Loyalty & Stamps View */}
        {view === "loyalty" && managed.length > 0 && (
          <details className="panel catalogue-edit-card" open>
            <summary>
              <strong>
                {es
                  ? "Programa de Sellos y Recompensas"
                  : "Stamps & Rewards Program"}
              </strong>
            </summary>

            <AutoTranslationNote locale={locale} />
            <form action={saveLoyaltyProgram} className="stack focused-form">
              <input type="hidden" name="locale" value={locale} />

              <div className="form-grid-two">
                <label>
                  {es ? "Local" : "Venue"}
                  <select name="venueId" required>
                    {managed.map(
                      (m) =>
                        m.venues && (
                          <option key={m.venues.id} value={m.venues.id}>
                            {m.venues.name}
                          </option>
                        ),
                    )}
                  </select>
                </label>

                <label>
                  {es ? "Sellos necesarios" : "Stamps required"}
                  <input
                    name="stampsRequired"
                    type="number"
                    min="2"
                    max="50"
                    defaultValue="8"
                    required
                  />
                </label>
              </div>

              <div className="form-grid-two">
                <label>
                  {es ? "Nombre del programa" : "Programme name"}
                  <input
                    name="title"
                    required
                    minLength={3}
                    placeholder={es ? "Ej. Tarjeta VIP" : "e.g. VIP Card"}
                  />
                </label>
              </div>

              <div className="form-grid-two">
                <label>
                  {es ? "Recompensa" : "Reward"}
                  <textarea
                    name="reward"
                    required
                    minLength={3}
                    rows={2}
                    placeholder={
                      es
                        ? "Ej. Bebida gratis en tu 8ª visita"
                        : "e.g. Free drink on 8th visit"
                    }
                  />
                </label>
              </div>

              <div className="form-actions-right">
                <button className="button primary" type="submit">
                  {es ? "Guardar programa" : "Save programme"}
                </button>
              </div>
            </form>

            {programs && programs.length > 0 && (
              <div className="managed-list">
                {programs.map((program) => (
                  <div className="managed-row" key={program.id}>
                    <div>
                      <strong>
                        {locale === "en"
                          ? program.title_en || program.title_es
                          : program.title_es}
                      </strong>
                      <span className="managed-meta">
                        <a
                          href={`/${locale}/check-in/${program.check_in_token}`}
                          className="inline-detail-link"
                        >
                          {es
                            ? "Abrir enlace de check-in"
                            : "Open check-in link"}
                        </a>
                      </span>
                    </div>
                    <span className="status-pill badge-neutral">
                      {program.stamps_required} {es ? "sellos" : "stamps"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </details>
        )}

        {view === "loyalty" && redemptions && redemptions.length > 0 && (
          <section className="panel catalogue-edit-card">
            <h2>
              {es
                ? "Recompensas pendientes de canje"
                : "Pending reward redemptions"}
            </h2>
            <div className="managed-list">
              {redemptions.map((item) => (
                <form
                  action={confirmRedemption}
                  className="managed-row"
                  key={item.id}
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="redemptionId" value={item.id} />
                  <strong>
                    {(
                      item.profiles as unknown as {
                        display_name: string | null;
                      } | null
                    )?.display_name || (es ? "Usuario" : "User")}
                  </strong>
                  <button className="button primary small-btn" type="submit">
                    {es ? "Confirmar entrega" : "Confirm handover"}
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}

        {scopedPulseEnabled && (
          <AkiPulseScoped
            locale={locale}
            kind={scopedPulseQuery.pulseKind}
            selected={pulseResource}
            scopes={pulseScopes}
            report={scopedPulseReport}
            unavailable={Boolean(
              scopeList.error ||
                scopeResult.error ||
                (pulseResource && !scopedPulseReport),
            )}
            page={scopedPulseQuery.pulsePage}
            hasMore={(scopeList.data || []).length > 50}
            days={days}
          />
        )}

        {pulseView && pulseEnabled && (
          <AkiPulse
            locale={locale}
            locations={analytics}
            days={days}
            selectedLocation={selectedLocation}
            availableLocations={availableLocations}
            truncated={scopedLocations.length > 20}
          />
        )}

        {pulseView && view !== "analytics" && !pulseEnabled && (
          <BusinessGrowthOverview
            locale={locale}
            events={businessEvents.length}
            venues={analytics.map((item) => ({
              id: item.id,
              name: item.name,
              events: item.events,
              interactions:
                item.metrics === null
                  ? null
                  : item.metrics.reduce((sum, row) => sum + row.current, 0),
            }))}
          />
        )}

        {/* Growth & Promotion Requests */}
        {pulseView && managed.length > 0 && (
          <details className="panel catalogue-edit-card" open>
            <summary>
              <strong>
                {es
                  ? "Solicitar Promoción Comercial"
                  : "Request Commercial Promotion"}
              </strong>
            </summary>

            {flags.promotion_requests ? (
              <form action={requestPromotion} className="stack focused-form">
                <input type="hidden" name="locale" value={locale} />

                <PromotionRequestFields
                  locale={locale}
                  venues={managed.flatMap((item) =>
                    item.venues
                      ? [{ id: item.venues.id, name: item.venues.name }]
                      : [],
                  )}
                  events={(promotionEvents || []).map((event) => ({
                    id: event.id,
                    venueId: event.venue_id,
                    title:
                      (es ? event.title_es : event.title_en) || event.title_es,
                  }))}
                />

                <div className="form-grid-two" hidden>
                  <label>
                    {es ? "Local" : "Venue"}
                    <select name="legacyVenueId" disabled>
                      {managed.map(
                        (item) =>
                          item.venues && (
                            <option key={item.venues.id} value={item.venues.id}>
                              {item.venues.name}
                            </option>
                          ),
                      )}
                    </select>
                  </label>

                  <label>
                    {es ? "Tipo de servicio" : "Service type"}
                    <select name="legacyService" disabled>
                      <option value="featured_listing">
                        {es ? "Destacado patrocinado" : "Sponsored feature"}
                      </option>
                      <option value="social_campaign">
                        {es
                          ? "Campaña en redes sociales"
                          : "Social media campaign"}
                      </option>
                      <option value="content_package">
                        {es
                          ? "Paquete de contenido VIP"
                          : "VIP Content package"}
                      </option>
                      <option value="other">
                        {es ? "Otro / Personalizado" : "Other / Custom"}
                      </option>
                    </select>
                  </label>
                </div>

                <label>
                  {es ? "Detalles de tu solicitud" : "Request details"}
                  <textarea
                    name="message"
                    required
                    minLength={20}
                    rows={4}
                    placeholder={
                      es
                        ? "Cuéntanos qué fechas y objetivos buscas promocionar..."
                        : "Tell us the dates and goals for your campaign..."
                    }
                  />
                </label>

                <div className="form-actions-right">
                  <button className="button primary" type="submit">
                    {es ? "Enviar solicitud" : "Send request"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="notice notice-error">
                {es
                  ? "Las nuevas solicitudes de promoción están pausadas temporalmente. Tus solicitudes anteriores siguen visibles."
                  : "New promotion requests are temporarily paused. Your previous requests remain visible."}
              </p>
            )}

            {promotions && promotions.length > 0 && (
              <div className="managed-list">
                {promotions.map((item) => (
                  <div className="managed-row" key={item.id}>
                    <strong>{item.service}</strong>
                    <span className="status-pill badge-neutral">
                      {item.state}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </details>
        )}

        {/* Analytics View */}
        {view === "analytics" &&
          !pulseEnabled &&
          analytics.map((item) => {
            const venue = item;
            const unavailable = item.metrics === null;
            const rows = (item.metrics || []).map((metric) => ({
              action: metric.action,
              total: metric.current,
            }));
            return (
              <section className="panel catalogue-edit-card" key={venue.id}>
                <h2>
                  {venue.name} · {es ? "Últimos 30 días" : "Last 30 days"}
                </h2>

                {unavailable ? (
                  <div className="catalogue-empty-card" role="alert">
                    <p>
                      {es
                        ? "No se pudieron cargar las analíticas de este local. No mostramos una actividad vacía hasta confirmar los datos."
                        : "Analytics for this venue could not be loaded. An empty activity state is hidden until the data can be confirmed."}
                    </p>
                    <Link
                      className="button secondary"
                      href={`${base}?view=analytics`}
                    >
                      {es ? "Reintentar" : "Retry"}
                    </Link>
                  </div>
                ) : rows.length ? (
                  <div className="workspace-summary-grid">
                    {rows.map((row) => (
                      <article
                        className="panel workspace-stat"
                        key={row.action}
                      >
                        <span>{row.action.replaceAll("_", " ")}</span>
                        <strong>{row.total}</strong>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="catalogue-empty-card">
                    <p>
                      {es
                        ? "Aún no hay actividad o impresiones registradas en los últimos 30 días."
                        : "No activity or impressions registered in the last 30 days yet."}
                    </p>
                  </div>
                )}
              </section>
            );
          })}

        {/* Claim Venue View */}
        {view === "claims" && (
          <section className="akibusiness-claim-workspace">
            <header className="akibusiness-section-hero">
              <div>
                <span>{es ? "Reclamar un local" : "Claim a venue"}</span>
                <h2>
                  {es
                    ? "Encuentra tu negocio en el mapa"
                    : "Find your business on the map"}
                </h2>
                <p>
                  {es
                    ? "Busca por nombre, ciudad o dirección, o navega por el mapa. Solo mostramos locales disponibles para reclamar."
                    : "Search by name, city or address, or browse the map. We only show venues available to claim."}
                </p>
              </div>
            </header>

            <form action={submitVenueClaim} className="akibusiness-claim-form">
              <input type="hidden" name="locale" value={locale} />

              <ClaimVenuePicker
                locale={locale}
                styleUrl={config.mapStyleUrl}
                initialVenueId={
                  query.venueId && /^[0-9a-f-]{36}$/i.test(query.venueId)
                    ? query.venueId
                    : undefined
                }
              />

              <div className="akibusiness-claim-details">
                <div className="akibusiness-claim-details-heading">
                  <h3>
                    {es ? "Tus datos de contacto" : "Your contact details"}
                  </h3>
                  <p>
                    {es
                      ? "Estos datos son solo para comprobar tu solicitud. No cambian la ficha pública del local."
                      : "These details are only used to review your claim. They will not change the venue’s public listing."}
                  </p>
                </div>
                <div className="akibusiness-claim-details-grid">
                  <label>
                    <span>{es ? "Nombre y apellidos" : "Full name"}</span>
                    <input
                      name="applicantName"
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      placeholder={es ? "Tu nombre completo" : "Your full name"}
                    />
                  </label>
                  <label>
                    <span>
                      {es
                        ? "Tu relación con el negocio"
                        : "Your role at the business"}
                    </span>
                    <select name="businessRole" required defaultValue="">
                      <option value="" disabled>
                        {es ? "Selecciona tu relación" : "Select your role"}
                      </option>
                      <option value="owner">
                        {es ? "Propietario/a" : "Owner"}
                      </option>
                      <option value="manager">
                        {es ? "Gerente / responsable" : "Manager"}
                      </option>
                      <option value="authorized">
                        {es
                          ? "Representante autorizado/a"
                          : "Authorised representative"}
                      </option>
                      <option value="employee">
                        {es ? "Empleado/a" : "Employee"}
                      </option>
                      <option value="other">
                        {es ? "Otra relación" : "Other"}
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>
                      {es
                        ? "Tu teléfono (opcional)"
                        : "Your phone number (optional)"}
                    </span>
                    <input
                      name="applicantPhone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={30}
                      placeholder="+34 600 000 000"
                    />
                  </label>
                  <label>
                    <span>
                      {es
                        ? "Email de trabajo (opcional)"
                        : "Business email (optional)"}
                    </span>
                    <input
                      name="businessEmail"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      placeholder="info@negocio.es"
                    />
                  </label>
                </div>
                <div className="akibusiness-claim-details-heading">
                  <h3>
                    {es
                      ? "Información para verificar el local"
                      : "Venue verification details"}
                  </h3>
                  <p>
                    {es
                      ? "Indica la web o el teléfono del negocio si los conoces. Los revisaremos antes de dar acceso."
                      : "Provide the venue website or phone if you know them. We’ll check them before granting access."}
                  </p>
                </div>
                <div className="akibusiness-claim-details-grid">
                  <label>
                    <span>
                      {es
                        ? "Web oficial del local (opcional)"
                        : "Official venue website (optional)"}
                    </span>
                    <input
                      name="businessWebsite"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      maxLength={500}
                      placeholder="https://negocio.es"
                    />
                  </label>
                  <label>
                    <span>
                      {es
                        ? "Teléfono del local (opcional)"
                        : "Venue phone number (optional)"}
                    </span>
                    <input
                      name="businessPhone"
                      type="tel"
                      inputMode="tel"
                      maxLength={30}
                      placeholder="+34 952 000 000"
                    />
                  </label>
                </div>
              </div>

              <label className="akibusiness-evidence-field">
                <span>
                  {es
                    ? "Demuestra que gestionas este negocio"
                    : "Show that you manage this business"}
                </span>
                <small>
                  {es
                    ? "Explica cómo podemos verificar que estás autorizado a gestionar este local. Evita incluir contraseñas o documentos sensibles."
                    : "Explain how we can verify that you are authorised to manage this venue. Never include passwords or sensitive documents."}
                </small>
                <textarea
                  name="evidence"
                  minLength={20}
                  required
                  rows={4}
                  placeholder={
                    es
                      ? "Por ejemplo: puedo responder desde el correo corporativo o confirmar la solicitud por teléfono..."
                      : "For example: I can reply from our business email or confirm this request by phone..."
                  }
                />
              </label>

              <div className="akibusiness-claim-submit">
                <p>
                  {es
                    ? "Revisaremos la solicitud antes de darte acceso de edición."
                    : "We will review the claim before granting editing access."}
                </p>
                <button className="button primary" type="submit">
                  {es ? "Enviar reclamación" : "Submit claim"}
                </button>
              </div>
            </form>
          </section>
        )}

        {view === "claims" && claims && claims.length > 0 && (
          <section className="panel catalogue-edit-card">
            <h2>{es ? "Historial de reclamaciones" : "Claims history"}</h2>
            <div className="managed-list">
              {claims.map((c) => (
                <div className="managed-row" key={c.id}>
                  <strong>
                    {(c.venues as unknown as { name: string } | null)?.name}
                  </strong>
                  <span className="status-pill badge-neutral">{c.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </WorkspaceShell>
  );
}

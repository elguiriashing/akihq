import {
  saveEventTemplate,
  useEventTemplate,
} from "@/app/[locale]/business/venue/[id]/premium-actions";
export function ListingTemplateLibrary({
  locale,
  venueId,
  premium,
  accommodation,
  templates,
  events,
}: {
  locale: "en" | "es";
  venueId: string;
  premium: boolean;
  accommodation: boolean;
  templates: Array<{ id: string; name: string }> | null;
  events: Array<{ id: string; title: string }>;
}) {
  const es = locale === "es";
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="venueId" value={venueId} />
    </>
  );
  return (
    <section className="panel">
      <h2>
        {es ? "Plantillas de eventos de la ficha" : "Listing event templates"}
      </h2>
      <p>
        {es
          ? "Guarda contenido reutilizable y crea un borrador. No se copian fechas ni se publica automáticamente."
          : "Save reusable content and create a draft. Dates are not copied and publication is never automatic."}
      </p>
      {!premium ? (
        <p>
          {es
            ? "Premium de la ficha permite guardar y reutilizar plantillas. Tus eventos actuales se conservan."
            : "Listing Premium lets you save and reuse templates. Existing events are retained."}{" "}
          <a
            href={`https://akipasa.com/${locale}/account/subscription?app=${accommodation ? "akiduermo" : "akibusiness"}`}
          >
            {es ? "Ver Premium de la ficha" : "View listing Premium"}
          </a>
        </p>
      ) : templates === null ? (
        <p role="alert">
          {es
            ? "No se pueden cargar las plantillas. Reintenta antes de crear un borrador."
            : "Templates could not be loaded. Retry before creating a draft."}
        </p>
      ) : (
        <>
          {events.length > 0 && (
            <form action={saveEventTemplate}>
              {hidden}
              <label>
                {es ? "Evento original" : "Source event"}
                <select name="eventId" required>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Nombre de plantilla" : "Template name"}
                <input name="name" required minLength={2} maxLength={100} />
              </label>
              <button>{es ? "Guardar plantilla" : "Save template"}</button>
            </form>
          )}
          {templates.length > 0 ? (
            <form action={useEventTemplate}>
              {hidden}
              <label>
                {es ? "Plantilla" : "Template"}
                <select name="templateId" required>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Identificador del nuevo evento" : "New event URL name"}
                <input
                  name="slug"
                  required
                  maxLength={150}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                />
              </label>
              <button>{es ? "Crear borrador" : "Create draft"}</button>
            </form>
          ) : (
            <p>
              {es
                ? "Todavía no hay plantillas disponibles."
                : "No templates are available yet."}
            </p>
          )}
        </>
      )}
    </section>
  );
}

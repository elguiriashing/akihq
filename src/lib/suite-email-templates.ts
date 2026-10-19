import { managementProduct, operationsProduct } from "./product-roles";
export const suiteEmailFrom = "AkiPasa Support <support@akipasa.com>";

export const suiteEmailKinds = [
  "claim_received",
  "welcome_akipasa",
  "welcome_akiduermo",
  "welcome_akibusiness",
  "welcome_akihq",
  "event_booking_requested",
  "event_booking_cancelled",
  "stay_booking_requested",
  "stay_booking_cancelled",
  "event_saved_reminder",
  "stay_saved_reminder",
] as const;

export type SuiteEmailKind = (typeof suiteEmailKinds)[number];
export type SuiteEmailLocale = "en" | "es";
export type SuiteEmailPayload = Record<string, unknown>;
export type SuiteRenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const escaped = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] || char,
  );
const clean = (value: unknown, max = 150) =>
  String(value ?? "")
    .replace(/[\r\n]/g, " ")
    .trim()
    .slice(0, max);
const value = (payload: SuiteEmailPayload, key: string, fallback = "") =>
  clean(payload[key], 220) || fallback;
const appUrl = (product: string, locale: SuiteEmailLocale) =>
  product === "akiduermo"
    ? "https://akiduermo.com/"
    : product === "akibusiness"
      ? managementProduct.origin + "/" + locale + "/business"
      : product === "akihq"
        ? operationsProduct.origin + "/"
        : "https://akipasa.com/" + locale;
const stayBookingsUrl = (locale: SuiteEmailLocale) =>
  "https://akiduermo.com/bookings?lang=" + locale;
const eventBookingsUrl = (locale: SuiteEmailLocale) =>
  "https://akipasa.com/" + locale + "/account/bookings";
const formatTime = (input: unknown, locale: SuiteEmailLocale) => {
  const d = new Date(String(input ?? ""));
  if (!Number.isFinite(d.getTime()))
    return locale === "es" ? "Por confirmar" : "To be confirmed";
  return d.toLocaleString(locale === "es" ? "es-ES" : "en-GB", {
    timeZone: "Europe/Madrid",
    dateStyle: "long",
    timeStyle: "short",
  });
};

type MailCopy = {
  product: "akipasa" | "akiduermo" | "akibusiness" | "akihq";
  subject: string;
  heading: string;
  intro: string;
  facts: Array<[string, string]>;
  steps: string[];
  button: string;
  href: string;
  footer: string;
};

export function suiteEmailCopy(
  kind: SuiteEmailKind,
  locale: SuiteEmailLocale,
  payload: SuiteEmailPayload = {},
): MailCopy {
  const es = locale === "es";
  const venue = value(payload, "venueName", es ? "el local" : "the venue");
  const stay = value(payload, "venueName", es ? "el alojamiento" : "the stay");
  const eventName = value(
    payload,
    "eventName",
    es ? "tu evento" : "your event",
  );
  const reference = value(payload, "claimId") || value(payload, "bookingId");
  const ref: [string, string][] = reference
    ? [[es ? "Referencia" : "Reference", reference]]
    : [];
  const guestCount = value(payload, "guestCount") || value(payload, "guests");
  const guests: [string, string][] = guestCount
    ? [[es ? "Personas" : "Guests", guestCount]]
    : [];
  const date = payload.bookingStart
    ? [
        [es ? "Fecha" : "Date", formatTime(payload.bookingStart, locale)] as [
          string,
          string,
        ],
      ]
    : [];
  const dates: Array<[string, string]> =
    payload.checkIn || payload.checkOut
      ? [
          [es ? "Entrada" : "Check-in", value(payload, "checkIn", "-")],
          [es ? "Salida" : "Check-out", value(payload, "checkOut", "-")],
        ]
      : [];
  const stayHref = stayBookingsUrl(locale);
  const baseFooter = es
    ? "Este mensaje es informativo. Para obtener ayuda, responde a este correo. AkiPasa no solicita contraseñas por email."
    : "This message is informational. For help, reply to this email. AkiPasa never asks for passwords by email.";
  const notConfirmed = es
    ? "Tu solicitud aún no es una reserva confirmada. El local deberá revisarla."
    : "Your request is not yet a confirmed booking. The venue must review it.";
  const reminderFooter = es
    ? "Recibes este recordatorio porque lo activaste en tu cuenta. Puedes desactivarlo en Guardados o Ajustes."
    : "You receive this reminder because you enabled it. You can turn it off in Saved items or Settings.";
  switch (kind) {
    case "claim_received":
      return {
        product: "akibusiness",
        subject:
          (es
            ? "Hemos recibido tu reclamación"
            : "We've received your business claim") +
          " · " +
          venue,
        heading: es
          ? "Tu reclamación está en revisión"
          : "Your claim is in review",
        intro: es
          ? "Hemos recibido tu solicitud para gestionar " +
            venue +
            ". Nuestro equipo de soporte revisará la información y se pondrá en contacto contigo pronto. No tienes que volver a enviarla."
          : "We've received your request to manage " +
            venue +
            ". Our support team will review the information and get in touch with you soon. You don't need to submit it again.",
        facts: [[es ? "Local" : "Venue", venue], ...ref],
        steps: [
          es
            ? "Revisaremos la relación con el negocio y las pruebas facilitadas."
            : "We'll review your business relationship and submitted evidence.",
          es
            ? "Te informaremos de la decisión o solicitaremos información adicional."
            : "We'll contact you with a decision or if more information is needed.",
        ],
        button: es
          ? `Abrir ${managementProduct.name}`
          : `Open ${managementProduct.name}`,
        href: appUrl("akibusiness", locale) + "?view=claims",
        footer: baseFooter,
      };
    case "welcome_akipasa":
      return {
        product: "akipasa",
        subject: es ? "¡Bienvenido a AkiPasa!" : "Welcome to AkiPasa!",
        heading: es
          ? "Descubre dónde pasa todo"
          : "Discover what's happening around you",
        intro: es
          ? "¡Tu cuenta está lista! Explora locales, eventos y ofertas, guarda tus favoritos y descubre nuevas experiencias por España."
          : "Your account is ready! Discover venues, events and offers, save favourites and explore new experiences across Spain.",
        facts: [],
        steps: [
          es
            ? "Busca locales y eventos cerca de ti."
            : "Explore venues and events near you.",
          es
            ? "Guarda planes y vuelve a ellos cuando quieras."
            : "Save plans and revisit them anytime.",
          es
            ? "Descubre tu pasaporte y tus logros."
            : "Explore your passport and achievements.",
        ],
        button: es ? "Empezar a explorar" : "Start exploring",
        href: appUrl("akipasa", locale),
        footer: baseFooter,
      };
    case "welcome_akiduermo":
      return {
        product: "akiduermo",
        subject: es ? "¡Bienvenido a AkiDuermo!" : "Welcome to AkiDuermo!",
        heading: es
          ? "Tu próxima escapada comienza aquí"
          : "Your next getaway begins here",
        intro: es
          ? "Ya puedes buscar alojamientos, consultar habitaciones disponibles, guardar estancias y consultar tus reservas desde el mismo sitio."
          : "You're ready to browse stays, check participating rooms, save favourites and review your reservations in one place.",
        facts: [],
        steps: [
          es
            ? "Descubre hoteles, apartamentos y casas rurales."
            : "Discover hotels, apartments and rural escapes.",
          es
            ? "Comprueba fechas, precios y condiciones antes de solicitar una reserva."
            : "Check availability, prices and terms before requesting a booking.",
          es
            ? "Revisa el estado de tus reservas desde Mis reservas."
            : "Track your reservations under My bookings.",
        ],
        button: es ? "Encontrar alojamiento" : "Find a stay",
        href: appUrl("akiduermo", locale),
        footer: baseFooter,
      };
    case "welcome_akibusiness":
      return {
        product: "akibusiness",
        subject: es
          ? `¡Bienvenido a ${managementProduct.name}!`
          : `Welcome to ${managementProduct.name}!`,
        heading: es
          ? "Haz que tu negocio destaque"
          : "Put your business on the map",
        intro: es
          ? `${managementProduct.name} te ayuda a reclamar y administrar tus locales y alojamientos, editar sus datos, gestionar eventos y reservas y mejorar su visibilidad.`
          : `${managementProduct.name} helps you claim and manage venues or accommodation listings, edit details, handle events and bookings, and improve visibility.`,
        facts: [],
        steps: [
          es
            ? "Reclama tu local y completa la verificación."
            : "Claim your venue and complete verification.",
          es
            ? "Actualiza descripción, fotos, horarios y datos de contacto."
            : "Update descriptions, photos, hours and contact details.",
          es
            ? "Utiliza las herramientas de eventos, reservas, promociones y analíticas disponibles."
            : "Explore the available event, booking, promotion and analytics tools.",
        ],
        button: es ? "Abrir mi panel de negocio" : "Open my business dashboard",
        href: appUrl("akibusiness", locale),
        footer: baseFooter,
      };
    case "welcome_akihq":
      return {
        product: "akihq",
        subject: es
          ? `¡Bienvenido a ${operationsProduct.name}!`
          : `Welcome to ${operationsProduct.name}!`,
        heading: es
          ? "Tu negocio, organizado en un solo lugar"
          : "Your business, organised in one place",
        intro: es
          ? `${operationsProduct.name} reúne herramientas de gestión: CRM, inventario, punto de venta, soporte, tareas, equipo y seguimiento de ventas.`
          : `${operationsProduct.name} brings your business tools together: CRM, inventory, point of sale, support, tasks, team collaboration and sales tracking.`,
        facts: [],
        steps: [
          es
            ? "Selecciona tu espacio de trabajo y configura los accesos de tu equipo."
            : "Choose your workspace and set up staff access.",
          es
            ? "Prepara categorías, productos, inventario y mesas del TPV si lo usas."
            : "Set up your till categories, products, inventory and tables if you use the PoS.",
          es
            ? "Consulta pedidos y ventas, tareas, soporte y clientes desde el panel."
            : "Review orders, sales, tasks, customer support and CRM from the dashboard.",
        ],
        button: es
          ? `Entrar en ${operationsProduct.name}`
          : `Open ${operationsProduct.name}`,
        href: appUrl("akihq", locale),
        footer: baseFooter,
      };
    case "event_booking_requested":
      return {
        product: "akipasa",
        subject: es
          ? "Solicitud de reserva recibida"
          : "Event booking request received",
        heading: es
          ? "Hemos recibido tu solicitud"
          : "Your request has been received",
        intro: es
          ? "Hemos recibido tu solicitud de reserva en " +
            venue +
            ". El organizador debe confirmarla; todavía no está garantizada."
          : "We've received your booking request for " +
            venue +
            ". The organiser still needs to confirm it, so your place is not yet guaranteed.",
        facts: [[es ? "Local" : "Venue", venue], ...date, ...guests, ...ref],
        steps: [notConfirmed],
        button: es ? "Consultar mis reservas" : "Track my bookings",
        href: eventBookingsUrl(locale),
        footer: baseFooter,
      };
    case "event_booking_cancelled":
      return {
        product: "akipasa",
        subject: es
          ? "Tu reserva de evento ha sido cancelada"
          : "Your event booking has been cancelled",
        heading: es ? "Reserva cancelada" : "Booking cancelled",
        intro: es
          ? "Confirmamos que tu reserva en " +
            venue +
            " está cancelada. Ya no figura entre tus reservas activas."
          : "Your booking at " +
            venue +
            " has been cancelled and no longer appears as active.",
        facts: [[es ? "Local" : "Venue", venue], ...date, ...ref],
        steps: [],
        button: es ? "Ver mis reservas" : "View my bookings",
        href: eventBookingsUrl(locale),
        footer: baseFooter,
      };
    case "stay_booking_requested":
      return {
        product: "akiduermo",
        subject: es
          ? "Hemos recibido tu solicitud de alojamiento"
          : "Stay reservation request received",
        heading: es
          ? "Tu estancia está pendiente de confirmación"
          : "Your stay is awaiting confirmation",
        intro: es
          ? "Tu solicitud para " +
            stay +
            " se ha registrado. El alojamiento debe confirmarla antes de que sea definitiva."
          : "Your request for " +
            stay +
            " has been recorded. The property must confirm it before your reservation is final.",
        facts: [
          [es ? "Alojamiento" : "Property", stay],
          ...dates,
          ...guests,
          ...ref,
        ],
        steps: [notConfirmed],
        button: es ? "Consultar la solicitud" : "Check request status",
        href: stayHref,
        footer: baseFooter,
      };
    case "stay_booking_cancelled":
      return {
        product: "akiduermo",
        subject: es
          ? "Reserva de alojamiento cancelada"
          : "Stay reservation cancelled",
        heading: es
          ? "Tu reserva se ha cancelado"
          : "Your stay has been cancelled",
        intro: es
          ? "La reserva de " +
            stay +
            " ha sido cancelada. Para cualquier condición de devolución, consulta las condiciones del alojamiento."
          : "Your reservation at " +
            stay +
            " has been cancelled. Check the property's terms for any applicable refund arrangements.",
        facts: [[es ? "Alojamiento" : "Property", stay], ...dates, ...ref],
        steps: [],
        button: es ? "Ver mis reservas" : "View my reservations",
        href: stayHref,
        footer: baseFooter,
      };
    case "event_saved_reminder":
      return {
        product: "akipasa",
        subject:
          (es
            ? "Tu evento guardado está a 2 días"
            : "Your saved event is in 2 days") +
          " · " +
          eventName,
        heading: es
          ? "¡Tu plan está a la vuelta de la esquina!"
          : "Your saved event is coming up",
        intro: es
          ? "Guardaste " +
            eventName +
            " en AkiPasa. ¡Faltan solo dos días! Consulta los detalles antes de salir."
          : "You saved " +
            eventName +
            " in AkiPasa. It's just two days away! Check the details before you go.",
        facts: [
          [es ? "Evento" : "Event", eventName],
          [es ? "Fecha" : "Date", formatTime(payload.startsAt, locale)],
        ],
        steps: [],
        button: es ? "Ver el evento" : "View event",
        href:
          "https://akipasa.com/" +
          locale +
          "/events/" +
          encodeURIComponent(value(payload, "slug", "events")),
        footer: reminderFooter,
      };
    case "stay_saved_reminder":
      return {
        product: "akiduermo",
        subject: es
          ? "¿Aún pensando en tu estancia guardada?"
          : "Still thinking about your saved stay?",
        heading: es
          ? "Tu alojamiento favorito sigue aquí"
          : "Your saved getaway is waiting",
        intro: es
          ? "Guardaste " +
            stay +
            " hace al menos cinco días y aún no has solicitado una reserva a través de AkiDuermo. Puedes volver a mirar fechas y disponibilidad."
          : "You saved " +
            stay +
            " at least five days ago and haven't requested a reservation through AkiDuermo. Revisit dates and availability whenever you're ready.",
        facts: [[es ? "Alojamiento" : "Property", stay]],
        steps: [
          es
            ? "La disponibilidad y los precios pueden cambiar."
            : "Availability and prices may change.",
        ],
        button: es ? "Volver al alojamiento" : "Explore the stay",
        href:
          "https://akiduermo.com/stays/" +
          encodeURIComponent(
            value(payload, "venueSlug") || value(payload, "venueId"),
          ),
        footer: reminderFooter,
      };
  }
}

const palette = {
  akipasa: { primary: "#ed7021", accent: "#f5aa40", label: "AkiPasa" },
  akiduermo: { primary: "#21876b", accent: "#50bb94", label: "AkiDuermo" },
  akibusiness: {
    primary: "#b27b00",
    accent: "#f5be3f",
    label: managementProduct.name,
  },
  akihq: {
    primary: "#7955c6",
    accent: "#ab82f7",
    label: operationsProduct.name,
  },
};

export function renderSuiteEmail(
  kind: SuiteEmailKind,
  locale: SuiteEmailLocale,
  payload: SuiteEmailPayload = {},
): SuiteRenderedEmail {
  const content = suiteEmailCopy(kind, locale, payload);
  const brand = palette[content.product];
  const subject = content.subject.replace(/[\r\n]/g, " ");
  const facts = content.facts.filter(([, v]) => Boolean(v));
  const factText = facts.map(([key, val]) => key + ": " + val);
  const text = [
    brand.label,
    "",
    content.heading,
    "",
    content.intro,
    "",
    ...factText,
    "",
    ...content.steps.map((step, i) => i + 1 + ". " + step),
    "",
    content.button + ": " + content.href,
    "",
    content.footer,
    "",
    "AkiPasa Marketing S.L. · support@akipasa.com",
  ].join("\n");
  const rows = facts
    .map(
      ([key, val]) =>
        '<tr><td style="padding:10px 13px;border-bottom:1px solid #e9eaf1;font-size:13px;color:#64728a;vertical-align:top">' +
        escaped(key) +
        '</td><td style="padding:10px 13px;border-bottom:1px solid #e9eaf1;font-size:14px;color:#1d2945;font-weight:700;overflow-wrap:anywhere">' +
        escaped(val) +
        "</td></tr>",
    )
    .join("");
  const steps = content.steps.length
    ? '<div style="padding-top:10px"><ol style="color:#26334c;font-size:15px;line-height:1.6;padding-left:23px">' +
      content.steps
        .map((step) => '<li style="padding:0 0 8px">' + escaped(step) + "</li>")
        .join("") +
      "</ol></div>"
    : "";
  const html =
    '<!doctype html><html lang="' +
    locale +
    '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escaped(subject) +
    '</title></head><body style="padding:0;margin:0;background:#f2f4f8;color:#16213b;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%"><table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="background:#f2f4f8"><tr><td style="padding:30px 12px"><table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="max-width:600px;margin:0 auto;background:white;border-radius:20px;overflow:hidden"><tr><td style="background:#15213b;color:white;padding:26px 30px;border-bottom:5px solid ' +
    brand.accent +
    '"><p style="margin:0;font-size:15px;font-weight:800;letter-spacing:.3px">' +
    brand.label +
    '</p><p style="margin:4px 0 0;font-size:12px;opacity:.78">AKISUITE · SUPPORT</p></td></tr><tr><td style="padding:30px"><h1 style="font-size:27px;line-height:1.24;letter-spacing:-.6px;margin:0 0 17px;color:#14213b">' +
    escaped(content.heading) +
    '</h1><p style="font-size:16px;line-height:1.68;color:#35415c;margin:0 0 22px">' +
    escaped(content.intro) +
    "</p>" +
    (rows
      ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e8e9ee;border-radius:12px;background:#fafbff;margin-bottom:15px">' +
        rows +
        "</table>"
      : "") +
    steps +
    '<p style="margin:27px 0 31px"><a href="' +
    escaped(content.href) +
    '" style="display:inline-block;color:white;text-decoration:none;font-weight:bold;font-size:15px;background:' +
    brand.primary +
    ';border-radius:11px;padding:15px 22px">' +
    escaped(content.button) +
    ' &rarr;</a></p><p style="font-size:12px;line-height:1.65;color:#718098;border-top:1px solid #e7eaf0;padding-top:18px">' +
    escaped(content.footer) +
    '</p><p style="font-size:12px;color:#657289">AkiPasa Marketing S.L. · <a href="mailto:support@akipasa.com" style="color:#435c87">support@akipasa.com</a></p></td></tr></table></td></tr></table></body></html>';
  return { subject, text, html };
}

export type SuiteEmailOutcome = {
  ok: boolean;
  messageId?: string;
  error?: string;
  ambiguous?: boolean;
  retryable?: boolean;
};

export async function sendSuiteEmail(
  id: string,
  kind: SuiteEmailKind,
  locale: SuiteEmailLocale,
  payload: SuiteEmailPayload,
  recipient: string,
  key?: string,
): Promise<SuiteEmailOutcome> {
  if (!key)
    return {
      ok: false,
      error: "api_key_missing",
      ambiguous: false,
      retryable: false,
    };
  const rendered = renderSuiteEmail(kind, locale, payload);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "Idempotency-Key": "akisuite-email-" + id,
      },
      body: JSON.stringify({
        from: suiteEmailFrom,
        reply_to: "support@akipasa.com",
        to: [recipient],
        ...rendered,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok)
      return {
        ok: false,
        error: "provider_" + res.status,
        retryable:
          res.status >= 500 || res.status === 429 || res.status === 409,
        ambiguous: res.status >= 500 || res.status === 409,
      };
    const json = (await res.json()) as { id?: string };
    if (typeof json.id === "string" && json.id)
      return { ok: true, messageId: json.id };
    return {
      ok: false,
      error: "provider_response_invalid",
      retryable: true,
      ambiguous: true,
    };
  } catch {
    return {
      ok: false,
      error: "provider_unreachable",
      retryable: true,
      ambiguous: true,
    };
  }
}

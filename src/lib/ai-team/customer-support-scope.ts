function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const supportSignals = [
  /\bakipasa\b/i,
  /\b(account|profile|login|sign[ -]?in|password|subscription|payment|billing|refund|venue|event|offer|claim|application|form|field|page|map|listing|publish|moderation|booking|passport|membership|check[ -]?in|support)\b/i,
  /\b(cuenta|perfil|iniciar sesion|contrasena|suscripcion|pago|facturacion|reembolso|local|evento|oferta|reclamacion|solicitud|formulario|campo|pagina|mapa|publicar|moderacion|reserva|pasaporte|membresia|soporte|ayuda)\b/i,
  /\b(here|this|these|current)\b.*\b(form|field|page|button|screen)\b/i,
  /\b(aqui|este|esta|estos|estas)\b.*\b(formulario|campo|pagina|boton|pantalla)\b/i,
];

const unrelatedTaskSignals = [
  /\b(write|make|build|debug|review|explain|generate|create)\b.{0,40}\b(code|python|javascript|typescript|java|c\+\+|sql|program|script|app|website|calculator|algorithm)\b/i,
  /\b(codigo|python|javascript|typescript|java|c\+\+|sql|programa|script|algoritmo|calculadora)\b/i,
  /\b(homework|essay|poem|story|joke|recipe|translate|translation|summarize this|cover letter|resume|cv)\b/i,
  /\b(tarea|ensayo|poema|historia|chiste|receta|traduce|traduccion|resume este|carta de presentacion|curriculum)\b/i,
  /\b(stock price|weather forecast|sports score|who is|capital of|solve this equation)\b/i,
  /\b(precio de .*accion|pronostico del tiempo|resultado deportivo|quien es|capital de|resuelve .*ecuacion)\b/i,
];

export function isCustomerSupportMessage(message: string) {
  const value = normalized(message);
  const hasSupportContext = supportSignals.some((pattern) =>
    pattern.test(value),
  );
  const hasUnrelatedTask = unrelatedTaskSignals.some((pattern) =>
    pattern.test(value),
  );
  return !hasUnrelatedTask || hasSupportContext;
}

export function outOfScopeSupportReply(locale: "en" | "es") {
  return locale === "es"
    ? "Solo puedo ayudar con AkiPasa, tu cuenta y las funciones o formularios de esta pagina. No puedo realizar tareas generales como escribir codigo, deberes o contenido no relacionado. Que necesitas hacer en AkiPasa?"
    : "I can only help with AkiPasa, your account, and the features or forms on this page. I can't handle general tasks such as writing code, homework, or unrelated content. What do you need help with in AkiPasa?";
}

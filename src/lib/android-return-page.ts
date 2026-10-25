/** Auth code stays in the external browser only until the installed app claims the deep link. */
export type AndroidReturnBrand = "pasa" | "duermo" | "coches" | "hq";
const paletteMap = {
  pasa: {
    primary: "#f26b1d",
    secondary: "#ffbc5b",
    glow: "rgba(242,107,29,.28)",
    glow2: "rgba(242,107,29,.12)",
    buttonText: "#111327",
  },
  duermo: {
    primary: "#15bda9",
    secondary: "#6be5d3",
    glow: "rgba(21,189,169,.25)",
    glow2: "rgba(21,189,169,.10)",
    buttonText: "#071c22",
  },
  coches: {
    primary: "#d43c59",
    secondary: "#fc8392",
    glow: "rgba(159,34,59,.3)",
    glow2: "rgba(159,34,59,.15)",
    buttonText: "#190b1a",
  },
  hq: {
    primary: "#f4c653",
    secondary: "#ffe0a0",
    glow: "rgba(244,198,83,.22)",
    glow2: "rgba(120,130,148,.13)",
    buttonText: "#13151d",
  },
} as const;
const dictionary = {
  en: {
    page: "Sign-in return",
    top: "Secure sign-in",
    description:
      "You’ve finished with your provider. Let’s return to the app to complete sign-in.",
    count: "Returning in",
    seconds: "seconds",
    button: "Open {name} now",
    help: "App not opening? Tap the button above. Make sure the app is installed on this device.",
    footer: "Securely returning to your AkiSuite app",
  },
  es: {
    page: "Vuelta al inicio de sesión",
    top: "Inicio de sesión seguro",
    description:
      "Has terminado con tu proveedor. Vamos a abrir la aplicación para completar el inicio de sesión.",
    count: "Volviendo en",
    seconds: "segundos",
    button: "Abrir {name} ahora",
    help: "¿No se abre? Pulsa el botón de arriba y comprueba que tienes la aplicación instalada.",
    footer: "Regresando de forma segura a tu aplicación AkiSuite",
  },
} as const;
const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
export function renderAndroidReturnPage(options: {
  brand: AndroidReturnBrand;
  name: string;
  locale: "en" | "es";
  target: URL;
  nonce: string;
  script: string;
  id: string;
}) {
  const { brand, name, locale, target, nonce, script, id } = options;
  const palette = paletteMap[brand];
  const words = dictionary[locale];
  const copy = { ...words, button: words.button.replace("{name}", esc(name)) };
  const safeName = esc(name);
  const safeTarget = esc(target.toString());
  const css =
    '\n*{box-sizing:border-box}html,body{height:100%;margin:0}body{min-height:100svh;display:grid;place-items:center;padding:clamp(18px,5vw,50px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f6f6fd;background:radial-gradient(ellipse at 80% 12%,var(--glow),transparent 45%),radial-gradient(ellipse at 12% 90%,var(--glow2),transparent 50%),#0c1021}.shell{width:min(100%,490px);text-align:center}.topline{display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:24px;color:#d0cee1;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}.topline::before{content:"";height:7px;width:7px;background:var(--accent);border-radius:50%;box-shadow:0 0 17px var(--accent)}.panel{position:relative;isolation:isolate;overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:32px;background:linear-gradient(150deg,rgba(255,255,255,.11),rgba(255,255,255,.035));box-shadow:0 24px 90px rgba(0,0,0,.38);padding:clamp(26px,6vw,48px) clamp(22px,6vw,42px);backdrop-filter:blur(24px)}.panel:before{content:"";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,var(--accent),transparent)}.symbol{height:88px;width:88px;margin:0 auto 18px;border-radius:23px;display:grid;place-items:center;background:rgba(255,255,255,.06);box-shadow:0 10px 34px var(--glow),inset 0 1px rgba(255,255,255,.09)}.symbol img{width:80px;height:80px;object-fit:contain;border-radius:19px}h1{font-size:clamp(31px,6vw,38px);line-height:1.1;letter-spacing:-.045em;margin:0 0 15px;font-weight:800}.sub{font-size:16px;line-height:1.6;color:#c8cadd;margin:0 auto 28px;max-width:31ch}.countline{font-size:14px;color:#d4d5e4;margin:0 0 15px}.countline strong{color:var(--accent);font-variant-numeric:tabular-nums}.bar{height:5px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.12);margin-bottom:28px}.bar span{display:block;height:100%;width:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),var(--accent2));transform-origin:left;animation:drain 5s linear forwards}.return-button{display:flex;align-items:center;justify-content:center;gap:12px;text-decoration:none;min-height:57px;padding:12px 22px;border-radius:17px;font-size:16px;line-height:1.3;font-weight:800;color:var(--buttonText);background:linear-gradient(115deg,var(--accent),var(--accent2));box-shadow:0 10px 30px var(--glow);transition:filter .18s,transform .18s}.return-button:hover{filter:brightness(1.09);transform:translateY(-2px)}.return-button:focus-visible{outline:3px solid #fff;outline-offset:4px}.return-button svg{height:20px;width:20px;flex:none}.help{font-size:12px;line-height:1.6;color:#aeb0c7;margin:20px auto 0;max-width:35ch}.foot{color:#858ca7;font-size:12px;margin:21px 0 0}@keyframes drain{to{transform:scaleX(0)}}@media(prefers-reduced-motion:reduce){.bar span{animation:none}.return-button{transition:none}}';
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#0c1021"><title>${safeName} · ${copy.page}</title><style>:root{--accent:${palette.primary};--accent2:${palette.secondary};--glow:${palette.glow};--glow2:${palette.glow2};--buttonText:${palette.buttonText}}${css}</style></head><body><main class="shell"><div class="topline">AkiSuite · ${copy.top}</div><section class="panel" aria-labelledby="return-title"><div class="symbol"><img src="/brand/v3/${brand}.svg" alt="" width="80" height="80"></div><h1 id="return-title">${safeName}</h1><p class="sub">${copy.description}</p><p class="countline" role="status" aria-live="off">${copy.count} <strong id="return-seconds">5</strong> ${copy.seconds}</p><div class="bar" aria-hidden="true"><span></span></div><a class="return-button" id="${id}" href="${safeTarget}"><span>${copy.button}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></a><p class="help">${copy.help}</p></section><p class="foot">${copy.footer}</p></main><script nonce="${nonce}">${script}</script></body></html>`;
}

// Adapted from the working AkiPasa master Android OAuth callback (2026-10-25).
// Codes return to the initiating WebView; its host-only PKCE verifier cookie
// must not be consumed by the external browser.
export function androidAuthHandoff(url: URL, locale: "en" | "es") {
  if (
    url.searchParams.get("android") !== "1" ||
    url.searchParams.get("native") === "1"
  )
    return null;
  const target = new URL("akihq://auth/callback");
  target.searchParams.set("locale", locale);
  for (const key of [
    "code",
    "next",
    "error",
    "error_code",
    "error_description",
  ]) {
    const value = url.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return target;
}

export const ANDROID_RETURN_SCRIPT =
  'setTimeout(function(){location.assign(document.getElementById("android-return").href)},2000);';

export function androidAuthPage(
  target: URL,
  locale: "en" | "es",
  nonce: string,
) {
  const href = target
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  const text = locale === "es" ? "Volver a AkiHQ" : "Return to AkiHQ";
  return `<!doctype html><html lang="${locale}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AkiHQ</title></head><body><h1>AkiHQ</h1><p>${locale === "es" ? "Vuelve a AkiHQ para terminar de iniciar sesión." : "Return to AkiHQ to finish signing in."}</p><a id="android-return" href="${href}">${text}</a><script nonce="${nonce}">${ANDROID_RETURN_SCRIPT}</script></body></html>`;
}

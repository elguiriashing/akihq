import { renderAndroidReturnPage } from "./android-return-page";

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
  'var seconds=5;var counter=document.getElementById("return-seconds");var ticker=setInterval(function(){seconds=Math.max(0,seconds-1);if(counter)counter.textContent=String(seconds);if(seconds===0)clearInterval(ticker)},1000);setTimeout(function(){location.assign(document.getElementById("android-return").href)},5000);';

export function androidAuthPage(
  target: URL,
  locale: "en" | "es",
  nonce: string,
) {
  return renderAndroidReturnPage({
    brand: "hq",
    name: "AkiHQ",
    locale,
    target,
    nonce,
    script: ANDROID_RETURN_SCRIPT,
    id: "android-return",
  });
}

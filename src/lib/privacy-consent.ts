export type PrivacyChoices = {
  analytics: boolean;
  personalisation: boolean;
  marketing: boolean;
};
export const deniedChoices: PrivacyChoices = {
  analytics: false,
  personalisation: false,
  marketing: false,
};
export function readPrivacyChoices(): PrivacyChoices {
  if (typeof document === "undefined") return { ...deniedChoices };
  const cookies = new Set(document.cookie.split("; "));
  return {
    analytics: cookies.has("ak_analytics=granted"),
    personalisation: cookies.has("ak_personalisation=granted"),
    marketing: cookies.has("ak_marketing=granted"),
  };
}
export function writePrivacyChoices(choices: PrivacyChoices) {
  const suffix = `; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  for (const [key, value] of Object.entries(choices))
    document.cookie = `ak_${key}=${value ? "granted" : "denied"}${suffix}`;
  document.cookie = `ak_consent_version=2${suffix}`;
  if (!choices.personalisation) {
    try {
      localStorage.removeItem("akipasa:behaviour-queue:v1");
    } catch {
      /* Storage may be disabled. */
    }
  }
  window.dispatchEvent(new Event("akipasa:consent-changed"));
}
export function openPrivacyChoices() {
  window.dispatchEvent(new Event("akipasa:privacy-open"));
}

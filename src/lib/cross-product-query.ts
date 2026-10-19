// Cross-origin handoffs keep discovery context, never authentication material.
// This does not run on same-origin OAuth/PKCE callbacks.
const credentialNames = [
  "code",
  "token",
  "token_hash",
  "access_token",
  "refresh_token",
  "id_token",
  "provider_token",
  "provider_refresh_token",
  "oauth_token",
  "oauth_token_secret",
  "authorization",
  "api_key",
  "apikey",
  "client_secret",
  "password",
  "state",
  "error_description",
];
const credentialKeys = new Set(credentialNames);
const credentialAssignment = new RegExp(
  `(?:^|[?&#;=,{\\[\\s.])["']?(?:${credentialNames.join("|")})(?:\\]|\\[[^\\]\\r\\n]{0,64}\\]|\\.[a-z0-9_-]{1,64})*["']?\\s*[:=]`,
  "i",
);
const wrappedCredentialKey = new RegExp(
  `(?:^|[.\\[])(?:${credentialNames.join("|")})(?=[.\\[\\]]|$)`,
  "i",
);
const MAX_QUERY_LENGTH = 8192;
const MAX_QUERY_FIELDS = 64;
const MAX_DECODE_ROUNDS = 4;
const MAX_JSON_DEPTH = 4;
const MAX_PARTS = 128;
const navigationWrapperKey =
  /^(?:next|redirect(?:to|uri|url)?|return(?:to|uri|url)?|callback(?:uri|url)?|continue|destination|url)$/i;

function navigationWrapper(value: string): boolean {
  // Opaque return destinations belong to the current origin, never a handoff.
  const root = value
    .trim()
    .split(/[.\[]/, 1)[0]
    .replace(/[\s_-]/g, "");
  return navigationWrapperKey.test(root);
}

function unsafeQueryPart(
  input: string,
  isKey: boolean,
  depth = 0,
  budget = { remaining: MAX_PARTS },
): boolean {
  if (depth > MAX_JSON_DEPTH || --budget.remaining < 0) return true;
  let value = input.replace(/\+/g, " ");
  for (let round = 0; round <= MAX_DECODE_ROUNDS; round++) {
    if (
      /[\u0000-\u001f\u007f]/.test(value) ||
      /(?:^|[\\/])(?:auth|oauth)(?:[\\/?#]|$)/i.test(value) ||
      credentialAssignment.test(value) ||
      /(?:^|[?&#;=,"'\s])(?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]*@/i.test(value) ||
      (isKey &&
        (credentialKeys.has(value.trim().toLowerCase()) ||
          navigationWrapper(value) ||
          wrappedCredentialKey.test(value)))
    )
      return true;
    if (/^\s*[\[{"]/.test(value)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        return true;
      }
      const inspectJson = (node: unknown, nodeDepth: number): boolean => {
        if (nodeDepth > MAX_JSON_DEPTH || --budget.remaining < 0) return true;
        if (typeof node === "string")
          return unsafeQueryPart(node, false, nodeDepth, budget);
        if (Array.isArray(node))
          return node.some((entry) => inspectJson(entry, nodeDepth + 1));
        if (node !== null && typeof node === "object")
          return Object.entries(node).some(
            ([key, entry]) =>
              unsafeQueryPart(key, true, nodeDepth, budget) ||
              inspectJson(entry, nodeDepth + 1),
          );
        return false;
      };
      if (inspectJson(parsed, depth + 1)) return true;
    }
    if (!value.includes("%")) return false;
    if (round === MAX_DECODE_ROUNDS) return true;
    try {
      value = decodeURIComponent(value).replace(/\+/g, " ");
    } catch {
      // Ambiguous/malformed nested encoding cannot safely cross an origin.
      return true;
    }
  }
  return true;
}

/** Mutates only the query on an already fixed, trusted destination URL. */
export function stripCrossProductCredentials(destination: URL): void {
  if (destination.search.length > MAX_QUERY_LENGTH) {
    destination.search = "";
    return;
  }
  const fields = [...destination.searchParams];
  if (fields.length > MAX_QUERY_FIELDS) {
    destination.search = "";
    return;
  }
  for (const [key, value] of fields) {
    if (unsafeQueryPart(key, true) || unsafeQueryPart(value, false))
      destination.searchParams.delete(key);
  }
}

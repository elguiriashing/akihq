export type CookieName = { name: string };

export function hasSupabaseAuthCookie(cookies: readonly CookieName[]) {
  return cookies.some(
    ({ name }) => name.startsWith("sb-") && name.includes("-auth-token"),
  );
}

export const venueDashboardSections = [
  "overview",
  "profile",
  "events",
  "catalogue",
  "rewards",
  "checkin",
  "bookings",
  "fleet",
  "team",
] as const;

export type VenueDashboardSection = (typeof venueDashboardSections)[number];

export function getVenueDashboardSection(
  query: Record<string, string | undefined>,
): VenueDashboardSection {
  if (venueDashboardSections.some((section) => section === query.section)) {
    return query.section as VenueDashboardSection;
  }
  const result = query.error || query.updated || "";
  if (/^(venue-delete|unclaim|member)$/.test(result)) return "team";
  if (/^(venue|media(?:-metadata|-removed)?)$/.test(result)) return "profile";
  if (
    /^(event(?:-deleted|-delete)?|occurrence(?:-status)?|recurrence|duplicate)$/.test(
      result,
    )
  )
    return "events";
  if (/^catalogue/.test(result)) return "catalogue";
  if (/^(catalogue)$/.test(result)) return "catalogue";
  if (/^(offer|stamp|reward|assignment)$/.test(result)) return "rewards";
  if (/^(credential|redemption)$/.test(result)) return "checkin";
  if (/^booking(?:-request|-slot)?$/.test(result)) return "bookings";
  return "overview";
}

import React, { type SVGProps } from "react";

/**
 * Single shared icon set for the whole app.
 * Keeping every glyph here means the rail, bottom nav, workspace
 * sidebars and cards all draw from one visual language instead of
 * each component inventing its own inline <svg>.
 */
export type IconName =
  | "bed"
  | "car"
  | "discover"
  | "map"
  | "community"
  | "passport"
  | "membership"
  | "account"
  | "home"
  | "person"
  | "saved"
  | "heart"
  | "heart-fill"
  | "search"
  | "bell"
  | "more"
  | "globe"
  | "sun"
  | "moon"
  | "close"
  | "chevron"
  | "star"
  | "activity"
  | "audit"
  | "business"
  | "calendar"
  | "gift"
  | "inbox"
  | "lock"
  | "megaphone"
  | "settings"
  | "shield"
  | "users"
  | "venue"
  | "arrow-right"
  | "share"
  | "directions"
  | "clock"
  | "plus"
  | "trash";

const paths: Record<IconName, React.ReactNode> = {
  car: (
    <>
      <path d="M5 16h14l-1.5-6H6.5L5 16Zm1.5-6 1-3h9l1 3M5 16v2m14-2v2M7.5 13h.01M16.5 13h.01" />
      <circle cx="7.5" cy="17" r="1" />
      <circle cx="16.5" cy="17" r="1" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2" />
    </>
  ),
  directions: <path d="m21 3-7 18-3-8-8-3 18-7Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bed: <path d="M3 19V9m18 10V11H3m0 6h18M6 11V5h12v6M12 5v6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>
  ),
  discover: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-2 5-5 2 2-5z" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s-6.5-5.4-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.6-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2" />
      <path d="M3 20c.6-4 2.6-6 6-6s5.4 2 6 6M15 15c3 0 5 1.5 6 4" />
    </>
  ),
  passport: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.4" />
      <path d="M9 16h6" />
    </>
  ),
  membership: (
    <>
      <path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8Z" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 21c.8-4.2 3.2-6.5 7-6.5s6.2 2.3 7 6.5" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M10 20v-6h4v6" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21c.8-4.5 3.2-7 7-7s6.2 2.5 7 7" />
    </>
  ),
  saved: <path d="M6 3h12v18l-6-4-6 4z" />,
  heart: (
    <path d="M12 20.5S4 15.2 4 9.7A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.7c0 5.5-8 10.8-8 10.8Z" />
  ),
  "heart-fill": (
    <path
      d="M12 20.5S4 15.2 4 9.7A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.7c0 5.5-8 10.8-8 10.8Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.7 4 6 4 9s-1.4 6.3-4 9c-2.6-2.7-4-6-4-9s1.4-6.3 4-9Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </>
  ),
  moon: <path d="M20 14.5a8.5 8.5 0 1 1-8.9-11 7 7 0 0 0 8.9 11Z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  star: (
    <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z" />
  ),
  activity: <path d="M4 13h3l2-6 4 10 2-5h5" />,
  audit: (
    <>
      <path d="M7 3h10v18H7z" />
      <path d="M10 8h4M10 12h4M10 16h3" />
    </>
  ),
  business: (
    <>
      <path d="M4 8h16v12H4zM8 8V4h8v4" />
      <path d="M4 13h16M10 12v3h4v-3" />
    </>
  ),
  calendar: (
    <>
      <path d="M4 6h16v14H4zM8 3v6M16 3v6M4 10h16" />
      <path d="M8 14h3M14 14h2M8 17h2" />
    </>
  ),
  gift: (
    <>
      <path d="M4 10h16v10H4zM3 7h18v4H3zM12 7v13" />
      <path d="M12 7c-4 0-5-1.5-5-3 0-1.2 1-2 2.2-2C11 2 12 4.5 12 7Zm0 0c4 0 5-1.5 5-3 0-1.2-1-2-2.2-2C13 2 12 4.5 12 7Z" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M4 13h4l2 3h4l2-3h4" />
    </>
  ),
  lock: (
    <>
      <path d="M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2" />
    </>
  ),
  megaphone: (
    <>
      <path d="m4 10 12-5v14L4 14zM16 9h3v6h-3" />
      <path d="m7 15 2 5h3l-2-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 5-3 8-8 10-5-2-8-5-8-10V6z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2" />
      <path d="M3 20c.6-4 2.6-6 6-6s5.4 2 6 6M15 15c3 0 5 1.5 6 4" />
    </>
  ),
  venue: (
    <>
      <path d="M5 9h14v12H5zM3 9l2-6h14l2 6" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({
  name,
  size,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

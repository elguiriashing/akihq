"use client";

import { BrandMark } from "./BrandLogo";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icons";

export type WorkspaceIcon = Extract<
  IconName,
  | "activity"
  | "audit"
  | "business"
  | "calendar"
  | "gift"
  | "home"
  | "inbox"
  | "lock"
  | "megaphone"
  | "person"
  | "saved"
  | "settings"
  | "shield"
  | "star"
  | "users"
  | "venue"
>;

export type WorkspaceItem = {
  href: string;
  label: string;
  icon: WorkspaceIcon;
  count?: number;
  matchPaths?: string[];
};

function matchesPath(
  pathname: string,
  searchParams: URLSearchParams,
  href: string,
) {
  const [hrefPath, query = ""] = href.split("?");
  if (query) {
    const expected = new URLSearchParams(query);
    return (
      pathname === hrefPath &&
      [...expected].every(([key, value]) => searchParams.get(key) === value)
    );
  }
  if (searchParams.has("view")) return false;
  return (
    pathname === hrefPath ||
    (hrefPath.split("/").length > 3 && pathname.startsWith(`${hrefPath}/`))
  );
}

export function WorkspaceShell({
  title,
  eyebrow,
  description,
  homeHref,
  items,
  navigationTitle = title,
  hidePageHeading = false,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  homeHref: string;
  items: WorkspaceItem[];
  navigationTitle?: string;
  hidePageHeading?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const desktopNavigationRef = useRef<HTMLElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const dragState = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
  });
  const spanish = homeHref.startsWith("/es/");
  const menuLabel = spanish ? "Menú" : "Menu";
  const consumerWorkspace = [
    "/account",
    "/business",
    "/admin",
    "/community",
    "/passports",
    "/staff",
  ].some((segment) => homeHref.includes(segment));
  const workspaceKind = homeHref.includes("/business")
    ? "business-workspace"
    : homeHref.includes("/staff")
      ? "staff-workspace"
      : homeHref.includes("/admin")
        ? "admin-workspace"
        : homeHref.includes("/account")
          ? "account-workspace"
          : homeHref.includes("/passports")
            ? "passports-workspace"
            : homeHref.includes("/community")
              ? "community-workspace"
              : "";
  const isItemActive = (item: WorkspaceItem) =>
    matchesPath(pathname, searchParams, item.href) ||
    (item.matchPaths || []).some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  const activeItem = items.find(isItemActive);

  function startNavigationDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const navigation = desktopNavigationRef.current;
    if (!navigation || navigation.scrollWidth <= navigation.clientWidth) return;
    dragState.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: navigation.scrollLeft,
    };
  }

  function moveNavigationDrag(event: React.PointerEvent<HTMLElement>) {
    const navigation = desktopNavigationRef.current;
    if (!navigation || !dragState.current.active) return;
    const distance = event.clientX - dragState.current.startX;
    if (!dragState.current.moved) {
      if (Math.abs(distance) <= 5) return;
      dragState.current.moved = true;
      navigation.setPointerCapture(event.pointerId);
      navigation.classList.add("is-dragging");
    }
    navigation.scrollLeft = dragState.current.scrollLeft - distance;
    event.preventDefault();
  }

  function endNavigationDrag(event: React.PointerEvent<HTMLElement>) {
    const navigation = desktopNavigationRef.current;
    if (!navigation) return;
    dragState.current.active = false;
    navigation.classList.remove("is-dragging");
    if (navigation.hasPointerCapture(event.pointerId))
      navigation.releasePointerCapture(event.pointerId);
  }

  function scrollNavigation(event: React.WheelEvent<HTMLElement>) {
    const navigation = desktopNavigationRef.current;
    if (!navigation || navigation.scrollWidth <= navigation.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    navigation.scrollLeft += event.deltaY;
    event.preventDefault();
  }

  useEffect(() => {
    if (!drawerOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !mobileNavigationRef.current?.contains(event.target)
      ) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 851px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    const navigation = desktopNavigationRef.current;
    const active = navigation?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (!navigation || !active) return;

    // Keep route changes from scrolling the page itself. scrollIntoView() can
    // move ancestor scrollers as well as this horizontal nav, which made the
    // desktop account bar appear to vanish on later items such as Profile.
    const navRect = navigation.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const leftOverflow = activeRect.left - navRect.left;
    const rightOverflow = activeRect.right - navRect.right;

    if (leftOverflow < 0) {
      navigation.scrollTo({
        left: Math.max(0, navigation.scrollLeft + leftOverflow - 12),
        behavior: "smooth",
      });
    } else if (rightOverflow > 0) {
      navigation.scrollTo({
        left: navigation.scrollLeft + rightOverflow + 12,
        behavior: "smooth",
      });
    }
  }, [pathname, searchParams]);

  const renderNavigation = (mobile = false) => (
    <>
      <div className="workspace-brand">
        <Link href={homeHref} onClick={() => setDrawerOpen(false)}>
          <span className="workspace-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="workspace-brand-copy">
            <strong>{navigationTitle}</strong>
            <small>{eyebrow}</small>
          </span>
        </Link>
        <button
          className="workspace-collapse"
          type="button"
          aria-label={
            collapsed
              ? spanish
                ? "Ampliar navegación"
                : "Expand sidebar"
              : spanish
                ? "Contraer navegación"
                : "Collapse sidebar"
          }
          onClick={() => setCollapsed((value) => !value)}
        >
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>
      <nav
        className="workspace-navigation"
        aria-label={
          spanish
            ? `Secciones de ${navigationTitle}`
            : `${navigationTitle} sections`
        }
        ref={mobile ? undefined : desktopNavigationRef}
        onPointerDown={startNavigationDrag}
        onPointerMove={moveNavigationDrag}
        onPointerUp={endNavigationDrag}
        onPointerCancel={endNavigationDrag}
        onWheel={scrollNavigation}
      >
        {items.map((item) => {
          const active = isItemActive(item);
          return (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={active ? "active" : undefined}
              onClick={(event) => {
                if (dragState.current.moved) {
                  event.preventDefault();
                  dragState.current.moved = false;
                  return;
                }
                setDrawerOpen(false);
              }}
              key={item.href}
              title={collapsed ? item.label : undefined}
            >
              <span className="workspace-glyph">
                <Icon name={item.icon} />
              </span>
              <span className="workspace-link-label">{item.label}</span>
              {item.count !== undefined && (
                <strong className="workspace-count">{item.count}</strong>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <main
      className={[
        "workspace-shell",
        "workspace-grid-system",
        consumerWorkspace ? "consumer-workspace" : "",
        workspaceKind,
        collapsed ? "is-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      <div className="workspace-mobile-navigation" ref={mobileNavigationRef}>
        <button
          ref={mobileMenuButtonRef}
          className="workspace-mobile-trigger"
          type="button"
          aria-label={
            spanish
              ? `Menú de ${navigationTitle} · ${eyebrow}`
              : `${eyebrow} ${navigationTitle} menu`
          }
          aria-expanded={drawerOpen}
          aria-controls="workspace-mobile-drawer"
          onClick={() => setDrawerOpen((value) => !value)}
        >
          <span className="workspace-menu-glyph" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <small>{eyebrow}</small>
            <strong>{activeItem?.label ?? navigationTitle}</strong>
          </span>
          <span aria-hidden="true">{menuLabel}</span>
        </button>

        {drawerOpen && (
          <div className="workspace-drawer-layer" id="workspace-mobile-drawer">
            <aside
              className="workspace-drawer"
              aria-label={
                spanish
                  ? `Navegación de ${navigationTitle}`
                  : `${navigationTitle} navigation`
              }
            >
              {renderNavigation(true)}
            </aside>
          </div>
        )}
      </div>

      <aside className="workspace-sidebar">{renderNavigation()}</aside>

      <div className="workspace-content">
        {!hidePageHeading && (
          <header className="workspace-page-heading">
            <div>
              <span>{eyebrow}</span>
              <h1>{title}</h1>
            </div>
            <p>{description}</p>
          </header>
        )}
        <div className="workspace-grid-body">{children}</div>
      </div>
    </main>
  );
}

export function WorkspacePageHeader({
  eyebrow,
  title,
  description,
  actions,
  level = 2,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <header className="workspace-section-heading">
      <div>
        <span>{eyebrow}</span>
        <Heading>{title}</Heading>
        <p>{description}</p>
      </div>
      {actions && <div className="workspace-heading-actions">{actions}</div>}
    </header>
  );
}

export function WorkspaceEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="workspace-empty panel">
      <span className="workspace-glyph">
        <Icon name="inbox" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </section>
  );
}

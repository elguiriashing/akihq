import { managementProduct } from "../lib/product-roles";
import Link from "next/link";
import { PortalLogo } from "./PortalLogo";
import { PortalHeaderTools } from "./PortalHeaderTools";

export function BusinessHeader({
  locale,
  signedIn,
  signOut,
}: {
  locale: "en" | "es";
  signedIn: boolean;
  signOut: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <header className="akibusiness-topbar">
      <Link
        className="akibusiness-brand"
        aria-label={managementProduct.name}
        href={`/${locale}/business`}
      >
        <PortalLogo product={managementProduct.logo} />
      </Link>
      <PortalHeaderTools locale={locale} product="business">
        {signedIn && (
          <form action={signOut} className="akibusiness-logout-form">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit">
              {locale === "es" ? "Cerrar sesión" : "Log out"}
            </button>
          </form>
        )}
      </PortalHeaderTools>
    </header>
  );
}

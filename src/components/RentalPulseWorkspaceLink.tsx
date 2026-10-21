"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRentalPulseWorkspace } from "@/app/actions/pulse";
import type { RentalPulseLinks } from "@/lib/pulse-rental-links";
export function RentalPulseWorkspaceLink({
  locale,
  company,
  links,
  page,
  days,
}: {
  locale: "en" | "es";
  company: string;
  links: RentalPulseLinks;
  page: number;
  days: number;
}) {
  const es = locale === "es",
    router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(links.current?.id || "");
  if (!links.can_link)
    return (
      <p>
        {es
          ? "Solo el propietario de la sucursal y del espacio operativo puede configurar este vínculo."
          : "Only the owner of both the rental branch and operating workspace can configure this link."}
      </p>
    );
  const choices = links.options.slice(0, 50);
  if (links.current && !choices.some((w) => w.id === links.current!.id))
    choices.unshift(links.current);
  const href = (n: number) =>
    `/${locale}/business?${new URLSearchParams({ view: "pulse", pulseKind: "fleet", pulseResource: company, pulseLinkPage: String(n), days: String(days) })}`;
  return (
    <details>
      <summary>
        {es
          ? "Vincular sucursal a un espacio operativo"
          : "Link rental branch to an operating workspace"}
      </summary>
      <p>
        {es
          ? "Elige explícitamente un espacio que también sea tuyo. Esto permite informes conjuntos de sus ubicaciones; no activa herramientas, pagos ni una suscripción. Las reservas conservan la identidad de la sucursal."
          : "Explicitly choose a workspace you also own. This enables reports for its linked locations; it does not activate tools, payments or a subscription. Bookings retain their branch identity."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const value = String(form.get("workspace") || "");
          start(async () => {
            let result: { ok: boolean };
            try {
              result = await saveRentalPulseWorkspace({
                company,
                workspace: value || null,
                locale,
              });
            } catch {
              result = { ok: false };
            }
            setNotice(
              result.ok
                ? es
                  ? "Vínculo guardado. Los permisos se vuelven a comprobar en cada informe."
                  : "Link saved. Permissions are checked again for every report."
                : es
                  ? "No se pudo guardar. Comprueba la propiedad y tus permisos e inténtalo de nuevo."
                  : "Could not save. Check ownership and permissions, then try again.",
            );
            if (result.ok) router.refresh();
          });
        }}
      >
        <label>
          {es ? "Espacio operativo" : "Operating workspace"}
          <select
            name="workspace"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={pending}
          >
            <option value="">{es ? "Sin vínculo" : "No link"}</option>
            {choices.map((w) => (
              <option value={w.id} key={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending}>
          {pending
            ? es
              ? "Guardando…"
              : "Saving…"
            : es
              ? "Guardar vínculo"
              : "Save link"}
        </button>
      </form>
      <nav
        aria-label={
          es ? "Páginas de espacios propios" : "Owned workspace pages"
        }
      >
        {page > 0 && (
          <a href={href(page - 1)}>{es ? "Anterior" : "Previous"}</a>
        )}
        {links.options.length > 50 && page < 200 && (
          <a href={href(page + 1)}>{es ? "Siguiente" : "Next"}</a>
        )}
      </nav>
      {notice && (
        <p role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </details>
  );
}

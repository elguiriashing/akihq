"use client";
import { useEffect, useState, type FormEvent } from "react";
type Team = {
  canManageTeam: boolean;
  ownerProfileId: string;
  members: { profile_id: string; role: string }[];
  total: number;
};
export function IndependentAccommodationTeam({
  property,
  locale,
}: {
  property: string;
  locale: "en" | "es";
}) {
  const es = locale === "es";
  const [team, setTeam] = useState<Team | null>(null),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setTeam(null);
    setError(false);
    fetch(
      `/api/business/accommodations?property=${encodeURIComponent(property)}&section=team&page=${page}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (active) setTeam(data);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [property, page, revision]);
  async function change(
    profile: string,
    role: "manager" | null,
    form?: HTMLFormElement,
  ) {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/business/accommodations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "member", property, profile, role }),
      });
      if (!r.ok) throw Error();
      form?.reset();
      setRevision((n) => n + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    void change(String(new FormData(form).get("profile")), "manager", form);
  }
  return (
    <section>
      <p>
        {es
          ? "El propietario puede conceder gestión a una cuenta verificada mediante su UUID exacto. No se envían invitaciones. No concede permisos en otras ubicaciones."
          : "The owner can grant management to a verified account using its exact UUID. No invitations are sent. This grants no rights at other locations."}
      </p>
      {error && (
        <p role="alert">
          {es
            ? "No se pudo completar la operación. Comprueba los permisos y vuelve a cargar."
            : "Could not complete the operation. Check permissions and reload."}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => setRevision((n) => n + 1)}
      >
        {es ? "Volver a cargar equipo" : "Reload team"}
      </button>
      {team && (
        <>
          <p>
            {es ? "Propietario" : "Owner"}: {team.ownerProfileId}
          </p>
          <ul>
            {team.members.map((m) => (
              <li key={m.profile_id}>
                {m.profile_id} · {m.role}
                {team.canManageTeam && m.profile_id !== team.ownerProfileId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void change(m.profile_id, null)}
                  >
                    {es ? "Revocar acceso" : "Revoke access"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy || page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            {es ? "Anterior" : "Previous"}
          </button>
          <span> {page + 1} </span>
          <button
            type="button"
            disabled={busy || page >= 100 || (page + 1) * 100 >= team.total}
            onClick={() => setPage((p) => p + 1)}
          >
            {es ? "Siguiente" : "Next"}
          </button>
          {team.canManageTeam ? (
            <form onSubmit={submit}>
              <label>
                {es ? "UUID de la cuenta verificada" : "Verified account UUID"}
                <input
                  name="profile"
                  required
                  pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                />
              </label>
              <p>
                {es
                  ? "Los gestores pueden modificar inventario, reservas, fotos y ficha. No pueden cambiar el equipo."
                  : "Managers can change inventory, reservations, photos and the profile. They cannot change the team."}
              </p>
              <button disabled={busy}>
                {es ? "Conceder gestión" : "Grant management"}
              </button>
            </form>
          ) : (
            <p>
              {es
                ? "Solo el propietario puede modificar el equipo. Los alojamientos vinculados a un local conservan su gestión de equipo existente."
                : "Only the owner can change the team. Venue-backed accommodation keeps its existing team management."}
            </p>
          )}
        </>
      )}
    </section>
  );
}

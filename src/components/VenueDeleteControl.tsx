"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import styles from "./VenueDeleteControl.module.css";

export function VenueDeleteControl({
  locale,
  venueId,
  venueName,
  action,
}: {
  locale: "en" | "es";
  venueId: string;
  venueName: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const es = locale === "es";
  const ready = reason.trim().length >= 10 && confirmation === "DELETE";

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => dialogRef.current?.showModal()}
        aria-label={es ? `Eliminar ${venueName}` : `Delete ${venueName}`}
      >
        <Icon name="trash" />
        <span>{es ? "Eliminar" : "Delete"}</span>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClose={() => {
          setReason("");
          setConfirmation("");
        }}
      >
        <form action={action} className={styles.card}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="venueId" value={venueId} />
          <div className={styles.heading}>
            <span className={styles.icon}>
              <Icon name="trash" />
            </span>
            <div>
              <small>{es ? "Acción permanente" : "Permanent action"}</small>
              <h2>{es ? `Eliminar ${venueName}` : `Delete ${venueName}`}</h2>
            </div>
          </div>
          <p className={styles.copy}>
            {es
              ? "El local, sus eventos y su contenido desaparecerán de AkiPasa. Si solo quieres dejar de gestionarlo, usa Desvincular en Equipo."
              : "The venue, its events and its content will disappear from AkiPasa. If you only want to stop managing it, use Unlink in Team instead."}
          </p>
          <label className={styles.field}>
            <span>
              {es ? "¿Por qué lo eliminas?" : "Why are you deleting it?"}
            </span>
            <textarea
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={2000}
              required
              rows={3}
              placeholder={
                es
                  ? "Ej. local de prueba, duplicado o cerrado permanentemente"
                  : "E.g. test venue, duplicate listing or permanently closed"
              }
            />
          </label>
          <label className={styles.field}>
            <span>
              {es ? "Escribe DELETE para confirmar" : "Type DELETE to confirm"}
            </span>
            <input
              name="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              pattern="DELETE"
              autoComplete="off"
              placeholder="DELETE"
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => dialogRef.current?.close()}
            >
              {es ? "Cancelar" : "Cancel"}
            </button>
            <button type="submit" className={styles.delete} disabled={!ready}>
              <Icon name="trash" />
              {es ? "Eliminar definitivamente" : "Delete permanently"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import styles from "./support-agent.module.css";

type SupportSurface = "business_application" | "site_contact";
type Message = { role: "user" | "assistant"; content: string };

function fieldValue(id: string) {
  const field = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  return field?.value.trim() || undefined;
}

function businessFormContext() {
  return {
    businessName: fieldValue("business-name"),
    locality: fieldValue("business-locality"),
    website: fieldValue("business-website"),
    about: fieldValue("business-about"),
  };
}

export function SupportAgentLauncher({
  locale,
  surface,
  label,
  className,
  signedIn,
  captureBusinessForm = false,
}: {
  locale: "en" | "es";
  surface: SupportSurface;
  label: string;
  className?: string;
  signedIn: boolean;
  captureBusinessForm?: boolean;
}) {
  const es = locale === "es";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const nearLatestRef = useRef(true);
  const requestPendingRef = useRef(false);
  const [newReply, setNewReply] = useState(false);
  const mailSubject = es ? "Ayuda con AkiPasa" : "Help with AkiPasa";
  const mailHref =
    "mailto:support@akipasa.com?subject=" + encodeURIComponent(mailSubject);
  const globalTrigger = className
    ?.split(/\s+/)
    .includes("global-support-trigger");

  const triggerContent = globalTrigger ? (
    <>
      <span className="global-support-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M9.1 9a3 3 0 1 1 5.82 1c0 2-2.92 2.55-2.92 4" />
          <path d="M12 18h.01" />
        </svg>
      </span>
      <span className="global-support-label">{label}</span>
    </>
  ) : (
    label
  );

  useEffect(() => {
    if (!signedIn && open) {
      setOpen(false);
      return;
    }
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    textareaRef.current?.focus();
    function focusableControls() {
      return Array.from(
        dialog!.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.closest("[hidden], [inert]") &&
          getComputedStyle(element).display !== "none" &&
          getComputedStyle(element).visibility !== "hidden",
      );
    }
    function containKeyboardFocus(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusableControls();
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function containProgrammaticFocus(event: FocusEvent) {
      if (event.target instanceof Node && !dialog!.contains(event.target)) {
        textareaRef.current?.focus();
      }
    }
    document.addEventListener("keydown", containKeyboardFocus, true);
    document.addEventListener("focusin", containProgrammaticFocus);
    return () => {
      document.removeEventListener("keydown", containKeyboardFocus, true);
      document.removeEventListener("focusin", containProgrammaticFocus);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, signedIn]);

  function showLatest() {
    const transcript = messagesRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
    nearLatestRef.current = true;
    setNewReply(false);
  }

  useEffect(() => {
    if (!open) return;
    if (nearLatestRef.current) showLatest();
    else if (messages.at(-1)?.role === "assistant") setNewReply(true);
  }, [messages, busy, open]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || requestPendingRef.current) return;
    requestPendingRef.current = true;
    const submitted: Message = { role: "user", content: question };
    setMessages((current) => [...current, submitted]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/support-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          locale,
          surface,
          pagePath: window.location.pathname,
          formContext: captureBusinessForm ? businessFormContext() : {},
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        text?: string;
        message?: string;
      };
      if (!response.ok || !result.ok || !result.text) {
        throw new Error(
          result.message ||
            (es
              ? "El asistente no está disponible ahora."
              : "The assistant is not available right now."),
        );
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.text || "" },
      ]);
    } catch (caught) {
      setMessages((current) =>
        current.filter((message) => message !== submitted),
      );
      setInput(question);
      setError(
        caught instanceof Error
          ? caught.message
          : es
            ? "No se pudo enviar la pregunta."
            : "The question could not be sent.",
      );
    } finally {
      requestPendingRef.current = false;
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <a className={className} href={mailHref}>
        {triggerContent}
      </a>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, className].filter(Boolean).join(" ")}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
      >
        {triggerContent}
      </button>
      {open && (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section
            ref={dialogRef}
            id={dialogId}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className={styles.badge}>
                  {es ? "Asistente con IA" : "AI assistant"}
                </span>
                <h2 id={`${dialogId}-title`}>
                  {es ? "Habla con Soporte" : "Chat with Support"}
                </h2>
                <p>
                  {es
                    ? "Puede orientarte sobre esta página. No envía formularios ni cambia tu cuenta."
                    : "It can guide you on this page. It cannot submit forms or change your account."}
                </p>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label={es ? "Cerrar ayuda" : "Close help"}
              >
                ×
              </button>
            </header>

            <div
              ref={messagesRef}
              className={styles.messages}
              aria-live="polite"
              aria-busy={busy}
              onScroll={(event) => {
                const element = event.currentTarget;
                nearLatestRef.current =
                  element.scrollHeight -
                    element.scrollTop -
                    element.clientHeight <
                  48;
                if (nearLatestRef.current) setNewReply(false);
              }}
            >
              {messages.length === 0 && (
                <p className={styles.welcome}>
                  {surface === "business_application"
                    ? es
                      ? "Dime qué parte del formulario te cuesta. También puedo ayudarte a redactar la descripción con tus propios datos."
                      : "Tell me which part of the form is difficult. I can also help draft the description using your facts."
                    : es
                      ? "¿En qué podemos ayudarte con AkiPasa?"
                      : "What can we help you with on AkiPasa?"}
                </p>
              )}
              {messages.map((message, index) => (
                <article
                  key={index}
                  className={
                    message.role === "user"
                      ? styles.userMessage
                      : styles.agentMessage
                  }
                >
                  <strong>
                    {message.role === "user"
                      ? es
                        ? "Tú"
                        : "You"
                      : es
                        ? "Soporte"
                        : "Support"}
                  </strong>
                  <p>{message.content}</p>
                </article>
              ))}
              {busy && (
                <p className={styles.thinking}>
                  {es ? "Soporte está respondiendo…" : "Support is replying…"}
                </p>
              )}
            </div>
            {newReply && (
              <button
                type="button"
                className={styles.latest}
                onClick={showLatest}
              >
                {es ? "Ver nueva respuesta" : "View new reply"}
              </button>
            )}

            <form className={styles.composer} onSubmit={send}>
              <label htmlFor={`${dialogId}-question`}>
                {es ? "Tu pregunta" : "Your question"}
              </label>
              <textarea
                ref={textareaRef}
                id={`${dialogId}-question`}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={2000}
                rows={3}
                required
                readOnly={busy}
                placeholder={
                  es
                    ? "Por ejemplo: ayúdame a describir mi negocio"
                    : "For example: help me describe my business"
                }
              />
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <div className={styles.actions}>
                <a href={mailHref}>
                  {es ? "Contactar con una persona" : "Contact a person"}
                </a>
                <button type="submit" disabled={busy || !input.trim()}>
                  {error
                    ? es
                      ? "Reintentar"
                      : "Retry"
                    : es
                      ? "Enviar"
                      : "Send"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { useFormStatus } from "react-dom";

const emailKey = "akipasa:auth-email";

export function AuthEmailInput({
  id,
  invalid = false,
  clear = false,
}: {
  id: string;
  invalid?: boolean;
  clear?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (clear) {
        sessionStorage.removeItem(emailKey);
        return;
      }
      const saved = sessionStorage.getItem(emailKey);
      if (saved && input.current && !input.current.value)
        input.current.value = saved;
    } catch {}
  }, [clear]);

  function rememberEmail(event: FormEvent<HTMLInputElement>) {
    try {
      sessionStorage.setItem(emailKey, event.currentTarget.value);
    } catch {}
  }

  return (
    <input
      ref={input}
      id={id}
      name="email"
      type="email"
      required
      autoComplete="email"
      placeholder="you@example.com"
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? "auth-error" : undefined}
      onInput={rememberEmail}
    />
  );
}

export function AuthSubmitButton({
  idle,
  pending,
  className = "button",
}: {
  idle: string;
  pending: string;
  className?: string;
}) {
  const status = useFormStatus();
  return (
    <button
      className={className}
      type="submit"
      disabled={status.pending}
      aria-disabled={status.pending}
    >
      {status.pending ? pending : idle}
    </button>
  );
}

"use client";

import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

type ServerFormAction = (formData: FormData) => void | Promise<void>;

function isFormReady(form: HTMLFormElement) {
  return (
    form.checkValidity() && !form.querySelector('[data-required-ready="false"]')
  );
}

function syncFormState(form: HTMLFormElement) {
  const ready = isFormReady(form);
  form.dataset.formReady = ready ? "true" : "false";
  form
    .querySelectorAll<
      HTMLButtonElement | HTMLInputElement
    >('button[type="submit"], input[type="submit"]')
    .forEach((control) => {
      control.disabled = !ready;
      control.setAttribute("aria-disabled", ready ? "false" : "true");
    });
}

export function GuardedActionForm({
  action,
  className,
  children,
}: {
  action: ServerFormAction;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    syncFormState(form);
    const observer = new MutationObserver(() => syncFormState(form));
    observer.observe(form, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-required-ready"],
    });

    return () => observer.disconnect();
  }, []);

  function handleFormEvent(event: FormEvent<HTMLFormElement>) {
    syncFormState(event.currentTarget);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    const target = event.target;

    if (target instanceof HTMLTextAreaElement) return;
    if (
      target instanceof HTMLButtonElement &&
      target.type === "submit" &&
      isFormReady(event.currentTarget)
    ) {
      return;
    }

    event.preventDefault();
    syncFormState(event.currentTarget);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isFormReady(event.currentTarget)) return;
    event.preventDefault();
    syncFormState(event.currentTarget);
    event.currentTarget.reportValidity();
  }

  return (
    <form
      ref={formRef}
      action={action}
      className={["guarded-action-form", className].filter(Boolean).join(" ")}
      data-form-ready="false"
      onInput={handleFormEvent}
      onChange={handleFormEvent}
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  );
}

"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import "./aki-selector.css";

/** Presentation only. Options and outcomes are supplied by the host feature. */
export type AkiSelectorEffect =
  | "ember"
  | "solar"
  | "bloom"
  | "breeze"
  | "aurora"
  | "quiet";

export type AkiSelectorOption = {
  id: string;
  label: string;
  symbol: ReactNode;
  accent?: string;
  effect?: AkiSelectorEffect;
  subtitle?: string;
  disabled?: boolean;
};

export type AkiSelectorProps = {
  options: readonly AkiSelectorOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string, option: AkiSelectorOption) => void;
  ariaLabel: string;
  intensity?: "subtle" | "balanced" | "cinematic";
  motion?: "auto" | "off";
  locale?: "en" | "es";
  className?: string;
  getOptionHref?: (option: AkiSelectorOption) => string;
  currentId?: string;
  showControls?: boolean;
};

function nearestEnabled(
  options: readonly AkiSelectorOption[],
  currentIndex: number,
  delta: number,
) {
  if (options.length === 0) return -1;
  for (let count = 1; count <= options.length; count += 1) {
    const index =
      (currentIndex + count * delta + options.length * count) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

export function AkiSelector({
  options,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  intensity = "balanced",
  motion = "auto",
  locale = "en",
  className = "",
  getOptionHref,
  currentId,
  showControls = true,
}: AkiSelectorProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? options.find((option) => !option.disabled)?.id ?? "",
  );
  const buttons = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);
  const startPoint = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const chosen = value === undefined ? uncontrolledValue : value;
  const chosenIndex = options.findIndex(
    (option) => option.id === chosen && !option.disabled,
  );
  const activeIndex =
    chosenIndex >= 0
      ? chosenIndex
      : options.findIndex((option) => !option.disabled);
  const active = activeIndex >= 0 ? options[activeIndex] : null;
  const es = locale === "es";

  useEffect(() => {
    if (pendingFocus.current && pendingFocus.current === active?.id) {
      buttons.current[activeIndex]?.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, [active?.id, activeIndex]);

  function choose(index: number, focus = false) {
    const candidate = options[index];
    if (!candidate || candidate.disabled) return;
    if (candidate.id === active?.id) {
      if (focus) buttons.current[index]?.focus({ preventScroll: true });
      return;
    }
    if (focus) pendingFocus.current = candidate.id;
    if (value === undefined) setUncontrolledValue(candidate.id);
    onValueChange?.(candidate.id, candidate);
  }

  function move(delta: number, focus = false) {
    const next = nearestEnabled(options, activeIndex, delta);
    if (next >= 0) choose(next, focus);
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    suppressClick.current = false;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(1, true);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(-1, true);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const available = options
        .map((option, index) => (!option.disabled ? index : -1))
        .filter((index) => index >= 0);
      const next = event.key === "Home" ? available[0] : available.at(-1);
      if (next !== undefined) choose(next, true);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // A new gesture must not inherit an unconsumed synthetic-click guard.
    suppressClick.current = false;
    startPoint.current =
      event.pointerType === "touch" || event.pointerType === "pen"
        ? { x: event.clientX, y: event.clientY, id: event.pointerId }
        : null;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = startPoint.current;
    startPoint.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    suppressClick.current = true;
    move(dx < 0 ? 1 : -1);
  }

  if (!active) {
    return (
      <div className="aks-selector aks-selector--empty" role="status">
        {es ? "No hay opciones disponibles." : "No options available."}
      </div>
    );
  }

  return (
    <section
      className={"aks-selector " + className}
      data-intensity={intensity}
      data-motion={motion}
      data-effect={active.effect ?? "quiet"}
      style={
        active.accent
          ? ({ "--aks-glow": active.accent } as CSSProperties)
          : undefined
      }
      aria-label={ariaLabel}
    >
      <div
        className="aks-selector__scene"
        role={getOptionHref ? "group" : "radiogroup"}
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          startPoint.current = null;
        }}
      >
        <div className="aks-selector__ambient" aria-hidden="true" />
        <div className="aks-selector__floor" aria-hidden="true" />
        {options.map((option, index) => {
          let distance = index - activeIndex;
          if (distance > options.length / 2) distance -= options.length;
          if (distance < -options.length / 2) distance += options.length;
          const selected = index === activeIndex;
          const farAway = Math.abs(distance) > 2;
          const style = {
            left: "calc(50% + " + distance * 31 + "%)",
            "--aks-order": String(Math.abs(distance)),
            ...(option.accent ? { "--aks-own-glow": option.accent } : {}),
          } as CSSProperties;
          const attributes = {
            ref: (element: HTMLButtonElement | HTMLAnchorElement | null) => {
              buttons.current[index] = element;
            },
            "aria-label": option.label,
            "aria-hidden": farAway || undefined,
            tabIndex: selected && !option.disabled ? 0 : -1,
            "data-selected": selected,
            "data-effect": option.effect ?? "quiet",
            className: "aks-selector__card",
            style,
            onKeyDown: handleKey,
          };
          const content = (
            <>
              <span className="aks-selector__effect" aria-hidden="true">
                <span className="aks-selector__effect-orbit" />
                <span className="aks-selector__effect-burst" />
                <span className="aks-selector__effect-sparks" />
              </span>
              <span className="aks-selector__card-face">
                <span className="aks-selector__symbol" aria-hidden="true">
                  {option.symbol}
                </span>
                <span className="aks-selector__label">{option.label}</span>
              </span>
            </>
          );
          return getOptionHref ? (
            <a
              key={option.id}
              {...attributes}
              href={
                option.disabled || farAway ? undefined : getOptionHref(option)
              }
              aria-current={option.id === currentId ? "page" : undefined}
              aria-disabled={option.disabled || farAway || undefined}
              onClick={(event) => {
                if (suppressClick.current || option.disabled || farAway) {
                  event.preventDefault();
                  suppressClick.current = false;
                }
              }}
            >
              {content}
            </a>
          ) : (
            <button
              key={option.id}
              {...attributes}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.disabled || farAway}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                choose(index);
              }}
            >
              {content}
            </button>
          );
        })}
      </div>
      {showControls && (
        <div className="aks-selector__footer">
          <button
            type="button"
            className="aks-selector__nav"
            onClick={() => move(-1, true)}
            aria-label={es ? "Opción anterior" : "Previous option"}
            disabled={options.filter((option) => !option.disabled).length < 2}
          >
            <span aria-hidden="true">←</span>
          </button>
          <div
            className="aks-selector__caption"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong>{active.label}</strong>
            <span>{active.subtitle ?? (es ? "Seleccionado" : "Selected")}</span>
            <small>
              {activeIndex + 1} / {options.length}
            </small>
          </div>
          <button
            type="button"
            className="aks-selector__nav"
            onClick={() => move(1, true)}
            aria-label={es ? "Opción siguiente" : "Next option"}
            disabled={options.filter((option) => !option.disabled).length < 2}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  );
}

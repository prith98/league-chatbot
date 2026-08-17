"use client";

import { useRef } from "react";

/* ============================================================================
   Controls

   Emphasis in this product is achromatic on purpose: a selected item inverts
   (paper ground, ink text) rather than turning a colour. Hue is reserved for
   data, so an affordance can never be mistaken for a reading, and vice-versa.
   ========================================================================= */

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-t1";

/* ---------------------------------------------------------------- Button -- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
    focusRing;
  const sizing =
    size === "sm"
      ? "h-8 px-3 text-[length:var(--step-ui)]"
      : "h-11 px-4 text-[length:var(--step-ui)] sm:h-10";
  const looks = {
    primary: "bg-t1 text-ink hover:bg-white",
    secondary: "border border-edge2 bg-s2 text-t1 hover:border-t3 hover:bg-s3",
    ghost: "text-t2 hover:bg-s2 hover:text-t1",
  }[variant];
  return <button className={`${base} ${sizing} ${looks} ${className}`} {...props} />;
}

/* ----------------------------------------------------------------- Field -- */

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label mb-1.5 flex items-baseline gap-2">
        <span>{label}</span>
        {hint && <span className="normal-case tracking-normal">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputBase =
  "h-11 w-full rounded-lg border border-edge bg-s2 px-3 text-[length:var(--step-body)] text-t1 transition-colors placeholder:text-t3 hover:border-edge2 sm:h-10 " +
  focusRing;

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${inputBase} ${className}`} {...rest} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      className={`${inputBase} cursor-pointer appearance-none bg-[position:right_0.6rem_center] bg-no-repeat pr-8 text-[length:var(--step-ui)] ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2397A3B8' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6.5 4 4 4-4'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    />
  );
}

/* ------------------------------------------------------- SegmentedControl -- */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Optional count rendered after the label, e.g. games in that role. */
  count?: number;
}

/**
 * The one control used for every in-card filter: sample window, queue, role,
 * outcome. It is a real radio group — arrow keys move the selection, the group
 * takes a single tab stop, and the selected option is announced. The three
 * ad-hoc pill rows it replaced were plain `<button>`s with no group semantics.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    onChange(next.value);
    // Move focus with the selection so the group behaves like one control.
    requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    });
  }

  const pad = size === "sm" ? "h-7 px-2" : "h-8 px-2.5";

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-edge bg-s2 p-0.5 ${className}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`mono inline-flex shrink-0 items-center gap-1 rounded-md text-[length:var(--step-label)] uppercase tracking-[0.07em] transition-colors ${pad} ${focusRing} ${
              on ? "bg-t1 font-medium text-ink" : "text-t2 hover:bg-s3 hover:text-t1"
            }`}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className={on ? "text-ink/75" : "text-t3"}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "./icons";

/**
 * One modal implementation for the whole app, built on the native `<dialog>`
 * element. `showModal()` gives us — from the platform, with no library and no
 * bugs of our own — a focus trap, Escape to dismiss, an inert background, and
 * focus returned to the trigger on close. The previous hand-rolled overlays had
 * none of those.
 *
 * Responsive by form, not by scale: a centred dialog from `sm` up, a bottom
 * sheet below it, because on a phone the thumb is at the bottom of the screen
 * and a vertically-centred form fights the keyboard.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // `showModal` makes the background inert but does not stop it scrolling.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-50 h-dvh max-h-dvh w-screen max-w-none bg-transparent"
    >
      {/* Clicking the plane outside the panel dismisses. */}
      <div
        className="flex h-dvh w-full items-end justify-center sm:items-center sm:p-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="sheet-panel flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-edge bg-s1 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.8)] sm:max-w-md sm:rounded-2xl sm:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]">
          {/* Grab handle — a mobile affordance, hidden where it would be a lie. */}
          <div className="flex justify-center pt-2.5 sm:hidden">
            <span className="h-1 w-9 rounded-full bg-edge2" />
          </div>

          <header className="flex items-start gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="display text-[length:var(--step-title)] text-t1">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-[length:var(--step-ui)] text-t2">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1.5 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-t2 transition-colors hover:bg-s3 hover:text-t1"
            >
              <Icon name="close" size={17} />
              <span className="sr-only">Close</span>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1">{children}</div>

          {footer && (
            <footer className="border-t border-edge px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </dialog>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/toast-provider";

const STORAGE_KEY = "formulax.scratchpad.v1";
const MAX_CHARS = 8000;

/**
 * Floating scratchpad for intermediate values during a multi-step calculation.
 *
 * `localStorage` only, no server round trip: a scratchpad is a thinking space, not data to
 * keep. The read is deferred to a task so the first paint matches the server's markup,
 * which is the same hydration approach `practice-quiz.tsx` uses.
 */
export function Scratchpad() {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let stored = "";
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      // Private mode or a blocked storage partition. The pad still works for this session.
    }
    const id = window.setTimeout(() => {
      setContent(stored);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const persist = useCallback(
    (next: string) => {
      setSaved(false);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
        setSaved(true);
      } catch {
        notify("This browser is not saving the scratchpad.", "error");
      }
    },
    [notify],
  );

  function onChange(next: string) {
    setContent(next);
    if (next.length > MAX_CHARS) {
      return;
    }
    persist(next);
  }

  function onClear() {
    setContent("");
    persist("");
    notify("Scratchpad cleared.", "info");
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const overLimit = content.length > MAX_CHARS;

  return (
    <>
      {open ? (
        <aside
          aria-label="Math scratchpad"
          className="fx-card-raised fixed right-4 bottom-4 z-50 flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Scratchpad</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onClear}
                className="fx-btn fx-btn-ghost px-2 py-1 text-xs"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close scratchpad"
                className="fx-btn fx-btn-ghost px-2 py-1"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          <label htmlFor="scratchpad-content" className="sr-only">
            Scratchpad notes
          </label>
          <textarea
            id="scratchpad-content"
            value={content}
            onChange={(event) => onChange(event.target.value)}
            rows={14}
            placeholder={"V1 = 12.0\nI1 = 0.024 A\nR1 = V1 / I1 = 500 ohm"}
            className="fx-input flex-1 resize-none font-mono text-sm"
            aria-describedby="scratchpad-status"
          />

          <p id="scratchpad-status" aria-live="polite" className="text-xs text-ink-faint">
            {overLimit
              ? `Over the ${MAX_CHARS} character limit, so this is not being saved`
              : saved && hydrated
                ? "Saved on this device"
                : "Stays on this device"}
          </p>
        </aside>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close scratchpad" : "Open scratchpad"}
        className="fx-btn fx-btn-primary fixed right-4 bottom-4 z-40 shadow-float"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
        <span className="hidden sm:inline">Scratchpad</span>
      </button>
    </>
  );
}

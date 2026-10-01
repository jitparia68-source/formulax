"use client";

import { useCallback, useRef, useState } from "react";

import { useToast } from "@/components/toast-provider";
import { latexToText } from "@/lib/latex-to-text";

type Target = "latex" | "text";

type Props = {
  /** Raw LaTeX exactly as stored on the formula row. */
  latex: string;
  /** Used to build the aria-labels, which must identify the formula, not the button. */
  title: string;
  /** Render the buttons inline with a compact label instead of icon-only. */
  compact?: boolean;
};

type Status = { target: Target; state: "copied" | "failed" } | null;

/**
 * Copy a formula out as either raw LaTeX (for Overleaf and other TeX editors) or a plain
 * text rendering (for Word, slides and email, where `R = V / I` beats
 * `R = \frac{V}{I}`).
 *
 * `navigator.clipboard` is not a given. It is absent in insecure contexts and in some
 * embedded webviews, and it rejects on permission grounds or when the document is not
 * focused. Success is therefore only reported when the returned promise actually
 * resolves; on rejection the raw LaTeX is revealed and selected so the user can copy it
 * by hand rather than being told a copy happened that did not.
 */
export function CopyFormulaButtons({ latex, title, compact = false }: Props) {
  const { notify } = useToast();
  const [status, setStatus] = useState<Status>(null);
  const fallbackRef = useRef<HTMLElement>(null);
  const resetTimerRef = useRef<number | null>(null);

  const showManualCopy = useCallback(() => {
    const node = fallbackRef.current;
    if (!node) {
      return;
    }
    // Reveal and select in one go: the user can read the source and press the platform
    // copy shortcut themselves.
    node.hidden = false;
    node.focus();
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => setStatus(null), 2000);
  }, []);

  const copy = useCallback(
    async (target: Target) => {
      const value = target === "latex" ? latex : latexToText(latex);

      if (typeof navigator === "undefined" || !navigator.clipboard) {
        setStatus({ target, state: "failed" });
        showManualCopy();
        notify(
          "Clipboard access is blocked in this browser. The LaTeX is selected for you.",
          "error",
        );
        scheduleReset();
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        setStatus({ target, state: "copied" });
        notify(
          target === "latex"
            ? `LaTeX for "${title}" copied.`
            : `Plain-text form of "${title}" copied.`,
          "success",
        );
        scheduleReset();
      } catch {
        // Rejected: permission denied, document not focused, or a non-secure origin.
        setStatus({ target, state: "failed" });
        showManualCopy();
        notify("Could not reach the clipboard. The LaTeX is selected for you.", "error");
        scheduleReset();
      }
    },
    [latex, notify, scheduleReset, showManualCopy, title],
  );

  const buttonClass = compact
    ? "fx-btn fx-btn-ghost px-2 py-1.5 text-xs"
    : "fx-btn fx-btn-secondary px-3 py-2 text-xs";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copy("latex")}
          className={buttonClass}
          aria-label={`Copy LaTeX source for ${title}`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 9V5.5A1.5 1.5 0 0 1 10.5 4h8A1.5 1.5 0 0 1 20 5.5v8a1.5 1.5 0 0 1-1.5 1.5H15" />
            <rect x="4" y="9" width="11" height="11" rx="1.5" />
          </svg>
          {status?.target === "latex" && status.state === "copied" ? "Copied" : "Copy LaTeX"}
        </button>

        <button
          type="button"
          onClick={() => void copy("text")}
          className={buttonClass}
          aria-label={`Copy ${title} as readable plain text`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16M4 11h11M4 16h7" />
          </svg>
          {status?.target === "text" && status.state === "copied"
            ? "Copied"
            : "Copy as text"}
        </button>
      </div>

      {/*
        The manual-copy fallback. Hidden until a write actually fails, so a successful copy
        leaves no stray node in the card, and `tabIndex` makes it focusable for keyboard
        users once it is shown.
      */}
      <code
        ref={fallbackRef}
        hidden
        tabIndex={-1}
        className="rounded-toast border border-danger/45 bg-danger/10 px-3 py-2 font-mono text-xs break-words text-danger-bright"
      >
        {latex}
      </code>
    </div>
  );
}
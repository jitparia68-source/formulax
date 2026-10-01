"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { saveFormulaNoteAction } from "@/app/actions";
import { useToast } from "@/components/toast-provider";

type Props = {
  slug: string;
  title: string;
  initialContent: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;
const MAX_NOTE_LENGTH = 4000;

/**
 * Autosaving study note attached to a formula.
 *
 * The debounce lives in an effect keyed on the text, which is the idiomatic place for it
 * and means the save routine is an Effect Event: it can read the current `slug` and
 * `notify` without a dependency array, and it can safely re-check the in-flight flag so
 * an edit made during a save is not dropped.
 *
 * The textarea only mounts once the user opens the note, so fifteen collapsed notes cost
 * fifteen buttons rather than fifteen live editors.
 */
export function FormulaNote({ slug, title, initialContent }: Props) {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [state, setState] = useState<SaveState>("idle");
  const [inFlight, setInFlight] = useState(false);

  const performSave = useEffectEvent(async (value: string) => {
    if (inFlight) {
      return;
    }
    setInFlight(true);
    setState("saving");

    const result = await saveFormulaNoteAction(slug, value);
    setInFlight(false);

    if (!result.success) {
      setState("error");
      notify(result.error, "error");
      return;
    }

    setSavedContent(value);
    // If the text moved on during the write, `isDirty` stays true and the debounce effect
    // fires again, so "saved" can never be shown for text that is not actually stored.
    setState("saved");
  });

  const isDirty = content.trim() !== savedContent.trim();

  useEffect(() => {
    if (!open || !isDirty) {
      return;
    }
    const timer = window.setTimeout(() => {
      void performSave(content);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // `performSave` is an Effect Event: stable by construction, and deliberately not a
    // dependency. It reads the current `slug` and `notify` without being re-created.
  }, [content, isDirty, open]);

  const atLimit = content.length >= MAX_NOTE_LENGTH;

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="fx-btn fx-btn-ghost px-2 py-1.5 text-xs"
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
          <path d="M5 4h14v16l-4-3-3 3-3-3-4 3z" />
        </svg>
        {initialContent ? "Edit note" : "Add a note"}
        <span className="sr-only"> for {title}</span>
      </button>

      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor={`note-${slug}`} className="sr-only">
            Study note for {title}
          </label>
          <textarea
            id={`note-${slug}`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            placeholder="e.g. Prof said this is on Midterm 2. Convert L to millihenries first."
            className="fx-input resize-y text-sm"
            aria-describedby={`note-status-${slug}`}
          />

          <p
            id={`note-status-${slug}`}
            aria-live="polite"
            className="text-xs text-ink-faint"
          >
            {state === "saving" ? "Saving..." : null}
            {state === "saved" && !isDirty ? "Saved" : null}
            {state === "error" ? "Not saved - try again" : null}
            {atLimit ? `At the ${MAX_NOTE_LENGTH} character limit` : null}
            {state === "idle" && !atLimit
              ? isDirty
                ? "Autosaves as you type"
                : ""
              : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}

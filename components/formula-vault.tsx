"use client";

import { useMemo, useState } from "react";

import { CopyFormulaButtons } from "@/components/copy-formula";
import { FormulaNote } from "@/components/formula-note";
import { MathFormula } from "@/components/math-formula";
import { useToast } from "@/components/toast-provider";
import { toggleBookmarkAction } from "@/app/actions";
import { FORMULA_CATEGORIES, type FormulaRow } from "@/types/database";

type Props = {
  formulas: FormulaRow[];
  initialBookmarks: string[];
  initialCategory: string | null;
  initialQuery?: string | null;
  /** Study notes keyed by formula slug, read once so the vault makes a single query. */
  initialNotes?: Record<string, string>;
};

const ALL = "All";

function matchesQuery(formula: FormulaRow, query: string): boolean {
  if (!query) {
    return true;
  }
  const needle = query.toLowerCase();
  return (
    formula.title.toLowerCase().includes(needle) ||
    formula.description.toLowerCase().includes(needle) ||
    formula.category.toLowerCase().includes(needle) ||
    formula.latex.toLowerCase().includes(needle)
  );
}

export function FormulaVault({
  formulas,
  initialBookmarks,
  initialCategory,
  initialQuery = null,
  initialNotes = {},
}: Props) {
  const { notify } = useToast();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [category, setCategory] = useState(
    initialCategory && FORMULA_CATEGORIES.includes(initialCategory as never)
      ? initialCategory
      : ALL,
  );
  const [bookmarks, setBookmarks] = useState(() => new Set(initialBookmarks));
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  // The bookmark call is a server action, so a pending flag is tracked explicitly rather
  // than via useTransition, which would mark the whole vault busy on every star.
  const isPending = pendingSlug !== null;

  const visible = useMemo(
    () =>
      formulas.filter(
        (formula) =>
          (category === ALL || formula.category === category) &&
          matchesQuery(formula, query.trim()),
      ),
    [formulas, category, query],
  );

  async function onToggleBookmark(formula: FormulaRow) {
    setPendingSlug(formula.slug);
    const result = await toggleBookmarkAction(formula.slug);
    setPendingSlug(null);

    if (!result.success) {
      notify(result.error, "error");
      return;
    }

    setBookmarks((current) => {
      const next = new Set(current);
      if (result.data.bookmarked) {
        next.add(formula.slug);
      } else {
        next.delete(formula.slug);
      }
      return next;
    });
    notify(
      result.data.bookmarked
        ? `Saved "${formula.title}" to your cheat sheet.`
        : `Removed "${formula.title}" from your cheat sheet.`,
      result.data.bookmarked ? "success" : "info",
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="fx-card p-4" aria-label="Filter formulas">
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="formula-search" className="sr-only">
              Search formulas
            </label>
            <input
              id="formula-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, equation or category..."
              className="fx-input"
            />
          </div>
          <div
            role="group"
            aria-label="Filter by category"
            className="flex flex-wrap gap-2"
          >
            {[ALL, ...FORMULA_CATEGORIES].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                aria-pressed={category === option}
                className={`fx-chip ${category === option ? "fx-chip-active" : ""}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <p aria-live="polite" className="text-xs text-ink-faint">
        {visible.length} of {formulas.length} formulas
        {isPending ? " - updating..." : ""}
      </p>

      {visible.length === 0 ? (
        <div className="fx-card px-6 py-12 text-center">
          <p className="text-sm font-medium">No formulas match that search</p>
          <p className="mt-1 text-sm text-ink-muted">
            Try a different term, or add it to your personal library below.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((formula) => {
            const saved = bookmarks.has(formula.slug);
            const busy = pendingSlug === formula.slug;
            return (
              <li key={formula.slug} className="fx-card-raised flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="fx-chip pointer-events-none cursor-default">
                    {formula.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onToggleBookmark(formula)}
                    disabled={busy}
                    aria-pressed={saved}
                    aria-label={
                      saved
                        ? `Remove ${formula.title} from cheat sheet`
                        : `Save ${formula.title} to cheat sheet`
                    }
                    className="fx-btn fx-btn-ghost px-2 text-warning disabled:opacity-50"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="size-4.5"
                      fill={saved ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    >
                      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                    </svg>
                  </button>
                </div>

                <h3 className="mt-3 font-medium text-ink">{formula.title}</h3>

                <div className="my-4">
                  <MathFormula latex={formula.latex} />
                </div>

                <p className="flex-1 text-sm text-ink-muted">
                  {formula.description}
                </p>

                <div className="mt-3">
                  <CopyFormulaButtons
                    latex={formula.latex}
                    title={formula.title}
                    compact
                  />
                </div>

                <FormulaNote
                  slug={formula.slug}
                  title={formula.title}
                  initialContent={initialNotes[formula.slug] ?? ""}
                />

                {formula.reference_url ? (
                  <a
                    href={formula.reference_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 truncate text-xs font-medium text-accent-bright hover:text-accent-hover"
                  >
                    Reference &nearr;
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

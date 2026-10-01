"use client";

import { useState, useTransition } from "react";

import { toggleBookmarkAction } from "@/app/actions";
import { MathFormula } from "@/components/math-formula";
import { useToast } from "@/components/toast-provider";
import type { FormulaRow } from "@/types/database";

type Props = {
  formulas: FormulaRow[];
  initialBookmarks: string[];
};

export function CheatSheet({ formulas, initialBookmarks }: Props) {
  const { notify } = useToast();
  const [bookmarks, setBookmarks] = useState(() => new Set(initialBookmarks));
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const saved = formulas.filter((formula) => bookmarks.has(formula.slug));

  function onUnstar(formula: FormulaRow) {
    startTransition(async () => {
      const result = await toggleBookmarkAction(formula.slug);
      if (!result.success) {
        notify(result.error, "error");
        return;
      }
      setBookmarks((current) => {
        const next = new Set(current);
        next.delete(formula.slug);
        return next;
      });
      notify(`Removed "${formula.title}".`, "info");
    });
  }

  async function onExport() {
    if (saved.length === 0) {
      return;
    }
    setIsExporting(true);
    try {
      // Loaded on demand so jsPDF stays out of the initial bundle.
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const width = doc.internal.pageSize.getWidth();
      let y = margin;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("FormulaX - Cheat Sheet", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(
        `${saved.length} formula${saved.length === 1 ? "" : "s"} - generated ${new Date().toLocaleDateString()}`,
        margin,
        y,
      );
      doc.setTextColor(0);
      y += 26;

      doc.setFontSize(10);
      for (const formula of saved) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${formula.title}  (${formula.category})`, margin, y);
        y += 14;
        doc.setFont("courier", "normal");
        doc.setFontSize(9);
        for (const line of doc.splitTextToSize(formula.latex, width - margin * 2)) {
          doc.text(line, margin, y);
          y += 11;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(90);
        for (const line of doc.splitTextToSize(formula.description, width - margin * 2)) {
          doc.text(line, margin, y);
          y += 11;
        }
        doc.setTextColor(0);
        y += 14;
      }

      doc.save("formulax-cheat-sheet.pdf");
      notify("Cheat sheet exported as PDF.", "success");
    } catch (error) {
      console.error("[formulax] pdf export", error);
      notify("The PDF could not be generated in this browser.", "error");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="fx-card p-4" aria-label="Cheat sheet actions">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            {saved.length === 0
              ? "Star formulas in the vault to collect them here."
              : `${saved.length} formula${saved.length === 1 ? "" : "s"} collected.`}
          </p>
          <button
            type="button"
            onClick={() => void onExport()}
            disabled={saved.length === 0 || isExporting || isPending}
            className="fx-btn fx-btn-primary"
          >
            {isExporting ? "Preparing PDF..." : "Export PDF"}
          </button>
        </div>
      </section>

      {saved.length === 0 ? (
        <div className="fx-card px-6 py-14 text-center">
          <p className="text-sm font-medium">Your cheat sheet is empty</p>
          <p className="mt-1 text-sm text-ink-muted">
            Open the vault and star the formulas you want to keep.
          </p>
          <a href="/formulas" className="fx-btn fx-btn-secondary mt-4">
            Open formula vault
          </a>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {saved.map((formula) => (
            <li key={formula.slug} className="fx-card-raised flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="fx-chip pointer-events-none cursor-default">
                    {formula.category}
                  </span>
                  <h2 className="mt-2 font-medium">{formula.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onUnstar(formula)}
                  disabled={isPending}
                  aria-label={`Remove ${formula.title} from cheat sheet`}
                  className="fx-btn fx-btn-ghost px-2 text-warning disabled:opacity-50"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-4.5"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  >
                    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                  </svg>
                </button>
              </div>
              <div className="my-3">
                <MathFormula latex={formula.latex} />
              </div>
              <p className="text-sm text-ink-muted">{formula.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

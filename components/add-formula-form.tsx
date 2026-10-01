"use client";

import { useRef, useState, useTransition } from "react";

import { addCustomFormulaAction, deleteCustomFormulaAction } from "@/app/actions";
import { useToast } from "@/components/toast-provider";
import { FORMULA_CATEGORIES } from "@/types/database";

export function AddFormulaForm() {
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addCustomFormulaAction(formData);
      if (!result.success) {
        setError(result.error);
        notify(result.error, "error");
        return;
      }
      formRef.current?.reset();
      notify("Formula added to your library.", "success");
    });
  }

  return (
    <section className="fx-card p-5" aria-labelledby="add-formula-heading">
      <h2 id="add-formula-heading" className="text-sm font-semibold">
        Add a personal formula
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Stored against your account and available in every tool on this workspace.
      </p>

      <form
        ref={formRef}
        action={onSubmit}
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="title" className="fx-label">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={160}
            placeholder="Bragg's Law"
            className="fx-input"
          />
        </div>

        <div>
          <label htmlFor="category" className="fx-label">
            Category
          </label>
          <select id="category" name="category" className="fx-input fx-select" required>
            {FORMULA_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="latex" className="fx-label">
            LaTeX expression
          </label>
          <input
            id="latex"
            name="latex"
            required
            maxLength={4000}
            placeholder="2d\sin\theta = n\lambda"
            className="fx-input font-mono text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="fx-label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            required
            maxLength={2000}
            rows={2}
            placeholder="Condition for constructive diffraction from a crystal lattice."
            className="fx-input resize-y"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="referenceUrl" className="fx-label">
            Reference URL <span className="text-ink-faint">(optional)</span>
          </label>
          <input
            id="referenceUrl"
            name="referenceUrl"
            type="url"
            maxLength={2048}
            placeholder="https://..."
            className="fx-input"
          />
        </div>

        {error ? (
          <p role="alert" className="fx-error sm:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <button type="submit" disabled={isPending} className="fx-btn fx-btn-primary">
            {isPending ? "Adding..." : "Add to library"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function DeleteFormulaButton({ slug, title }: { slug: string; title: string }) {
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();

  function onDelete(formData: FormData) {
    startTransition(async () => {
      const result = await deleteCustomFormulaAction(formData);
      if (!result.success) {
        notify(result.error, "error");
        return;
      }
      notify(`Deleted "${title}".`, "info");
    });
  }

  return (
    <form action={onDelete}>
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={`Delete ${title}`}
        className="fx-btn fx-btn-ghost px-2 text-danger-bright hover:text-danger disabled:opacity-50"
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
          <path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
        </svg>
      </button>
    </form>
  );
}

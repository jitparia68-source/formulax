"use client";

import { useRef, useState } from "react";

import { useToast } from "@/components/toast-provider";

type ScanState =
  | { phase: "idle" }
  | { phase: "scanning" }
  | { phase: "done"; text: string }
  | { phase: "error"; message: string };

export function FormulaScanner() {
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<ScanState>({ phase: "idle" });

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (!file) {
      setState({ phase: "idle" });
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setState({ phase: "idle" });
  }

  function reset() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setState({ phase: "idle" });
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function onScan() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      return;
    }

    setState({ phase: "scanning" });

    try {
      // Imported on demand so the OCR bundle and its wasm worker never load until the
      // user actually asks to scan.
      const { default: Tesseract } = await import("tesseract.js");
      const worker = await Tesseract.createWorker("eng");
      try {
        const result = await worker.recognize(file);
        const text = result.data.text.trim();
        if (!text) {
          setState({
            phase: "error",
            message: "No text was recognised in that image.",
          });
          return;
        }
        setState({ phase: "done", text });
        notify("Scan complete.", "success");
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      console.error("[formulax] ocr", error);
      setState({
        phase: "error",
        message:
          "OCR could not run in this browser. Try a smaller image, or enter the formula manually.",
      });
    }
  }

  return (
    <section className="fx-card p-5" aria-labelledby="scanner-heading">
      <h2 id="scanner-heading" className="text-sm font-semibold">
        OCR formula scanner
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Upload an image of a printed equation to pull out its text, then search or plot it.
        Recognition runs entirely in your browser.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <label htmlFor="scan-input" className="fx-label">
            Formula image
          </label>
          <input
            ref={inputRef}
            id="scan-input"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="fx-input file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
          />
        </div>

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected formula preview"
            className="max-h-48 w-fit rounded-input border border-line bg-surface-1 p-1"
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onScan()}
            disabled={!previewUrl || state.phase === "scanning"}
            className="fx-btn fx-btn-primary"
          >
            {state.phase === "scanning" ? "Scanning..." : "Scan formula"}
          </button>
          {previewUrl ? (
            <button type="button" onClick={reset} className="fx-btn fx-btn-secondary">
              Clear
            </button>
          ) : null}
        </div>

        <div aria-live="polite">
          {state.phase === "done" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="scan-output" className="fx-label">
                Recognised text
              </label>
              <textarea
                id="scan-output"
                readOnly
                rows={2}
                value={state.text}
                className="fx-input resize-y font-mono text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/formulas?query=${encodeURIComponent(state.text)}`}
                  className="fx-btn fx-btn-secondary"
                >
                  Search in vault
                </a>
                <a
                  href={`/plotter?expression=${encodeURIComponent(state.text)}`}
                  className="fx-btn fx-btn-secondary"
                >
                  Plot function
                </a>
              </div>
            </div>
          ) : null}

          {state.phase === "error" ? (
            <p className="fx-error">{state.message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

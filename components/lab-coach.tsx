"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  deleteLabRunAction,
  saveLabRunAction,
  type SaveLabRunInput,
} from "@/app/actions";
import { useToast } from "@/components/toast-provider";
import { linearRegression, predict, type LinearRegression } from "@/lib/regression";
import type { LabRunRow } from "@/types/database";

export type ExperimentPreset = {
  key: string;
  title: string;
  xLabel: string;
  yLabel: string;
  unitNote: string;
  sample: [number, number][];
};

export const LAB_EXPERIMENTS: readonly ExperimentPreset[] = [
  {
    key: "ohm",
    title: "Ohm's Law - resistance analysis",
    xLabel: "Current I (A)",
    yLabel: "Voltage V (V)",
    unitNote:
      "A linear V-I curve has gradient equal to resistance. Expect a slope near the nominal resistor value.",
    sample: [
      [0.1, 1.0],
      [0.2, 2.0],
      [0.3, 3.1],
      [0.4, 3.9],
      [0.5, 5.1],
    ],
  },
  {
    key: "pendulum",
    title: "Simple pendulum - acceleration due to gravity",
    xLabel: "Length L (m)",
    yLabel: "Period^2 T^2 (s^2)",
    unitNote:
      "Plotting T^2 against L gives a straight line of gradient 4*pi^2/g, so g = 4*pi^2 / slope.",
    sample: [
      [0.2, 0.9],
      [0.3, 1.1],
      [0.4, 1.27],
      [0.5, 1.42],
    ],
  },
  {
    key: "hooke",
    title: "Hooke's Law - spring constant",
    xLabel: "Extension x (m)",
    yLabel: "Force F (N)",
    unitNote:
      "In the linear region, force against extension has gradient k in N/m.",
    sample: [
      [0.01, 0.5],
      [0.02, 1.0],
      [0.03, 1.5],
      [0.04, 2.0],
    ],
  },
] as const;

type Row = { x: string; y: string };

function rowsFrom(sample: readonly (readonly [number, number])[]): Row[] {
  return sample.map(([x, y]) => ({ x: String(x), y: String(y) }));
}

type Analysis = LinearRegression & { points: [number, number][] };

function analyse(rows: Row[]): Analysis | null {
  const points: [number, number][] = [];
  for (const row of rows) {
    const x = Number(row.x);
    const y = Number(row.y);
    if (row.x.trim() !== "" && row.y.trim() !== "" && Number.isFinite(x) && Number.isFinite(y)) {
      points.push([x, y]);
    }
  }
  const regression = linearRegression(points);
  return regression ? { ...regression, points } : null;
}

export function LabCoach({ initialRuns }: { initialRuns: LabRunRow[] }) {
  const { notify } = useToast();
  const [experimentKey, setExperimentKey] = useState(LAB_EXPERIMENTS[0]!.key);
  const [rows, setRows] = useState<Row[]>(() =>
    rowsFrom(LAB_EXPERIMENTS[0]!.sample),
  );
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(LAB_EXPERIMENTS[0]!.title);
  const [savedRuns, setSavedRuns] = useState<LabRunRow[]>(initialRuns);
  const [isPending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const experiment =
    LAB_EXPERIMENTS.find((item) => item.key === experimentKey) ?? LAB_EXPERIMENTS[0]!;

  // Switching preset resets the working state in the handler rather than in an effect, so
  // the rows and the selected experiment can never disagree for a render.
  function onSelectExperiment(key: string) {
    const next = LAB_EXPERIMENTS.find((item) => item.key === key) ?? LAB_EXPERIMENTS[0]!;
    setExperimentKey(key);
    setRows(rowsFrom(next.sample));
    setAnalysis(null);
    setError(null);
    setTitle(next.title);
  }

  function loadSample() {
    setRows(rowsFrom(experiment.sample));
    setAnalysis(null);
    setError(null);
  }

  // The chart is a plain canvas so the regression line and points can be drawn together
  // without pulling in a charting dependency.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis || analysis.points.length === 0) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = 320;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);

    const xs = analysis.points.map(([x]) => x);
    const ys = analysis.points.map(([, y]) => y);
    const lineYs = [predict(analysis, Math.min(...xs)), predict(analysis, Math.max(...xs))];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys, ...lineYs);
    const maxY = Math.max(...ys, ...lineYs);
    const padY = (maxY - minY) * 0.1 || 1;
    const yLow = minY - padY;
    const yHigh = maxY + padY;

    const pad = 32;
    const toX = (value: number) =>
      pad + ((value - minX) / (maxX - minX || 1)) * (width - pad * 2);
    const toY = (value: number) =>
      height - pad - ((value - yLow) / (yHigh - yLow || 1)) * (height - pad * 2);

    context.strokeStyle = "#24334f";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(pad, pad);
    context.lineTo(pad, height - pad);
    context.lineTo(width - pad, height - pad);
    context.stroke();

    context.strokeStyle = "#6c5ce7";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(toX(minX), toY(predict(analysis, minX)));
    context.lineTo(toX(maxX), toY(predict(analysis, maxX)));
    context.stroke();

    context.fillStyle = "#34d399";
    for (const [x, y] of analysis.points) {
      context.beginPath();
      context.arc(toX(x), toY(y), 4, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "#64748f";
    context.font = "11px system-ui, sans-serif";
    context.fillText(experiment.xLabel, width - pad - context.measureText(experiment.xLabel).width, height - 8);
  }, [analysis, experiment]);

  function onRun() {
    const result = analyse(rows);
    if (!result) {
      setAnalysis(null);
      setError(
        "Enter at least two rows with finite x and y values that are not all at the same x.",
      );
      return;
    }
    setAnalysis(result);
    setError(null);
  }

  function onSave() {
    if (!analysis) {
      return;
    }
    const payload: SaveLabRunInput = {
      experimentKey: experiment.key,
      title: title.trim() || experiment.title,
      readings: analysis.points,
      slope: analysis.slope,
      rSquared: analysis.rSquared,
    };
    startTransition(async () => {
      const result = await saveLabRunAction(payload);
      if (!result.success) {
        notify(result.error, "error");
        return;
      }
      notify("Run saved to your lab notebook.", "success");
      // Re-read from the server so the history reflects the canonical rows.
      const { getUserData } = await import("@/app/actions");
      const data = await getUserData();
      if (data) {
        setSavedRuns(data.labRuns);
      }
    });
  }

  function onDownloadReport() {
    if (!analysis) {
      return;
    }
    void (async () => {
      try {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const margin = 48;
        let y = margin;

        doc.setFont("helvetica", "bold").setFontSize(16);
        doc.text("FormulaX - Lab Report", margin, y);
        y += 22;
        doc.setFont("helvetica", "normal").setFontSize(11);
        doc.text(title.trim() || experiment.title, margin, y);
        y += 18;
        doc.setFontSize(10).setTextColor(90);
        doc.text(experiment.unitNote, margin, y, { maxWidth: 500 });
        y += 30;
        doc.setTextColor(0);

        doc.setFontSize(10);
        for (const [label, value] of [
          ["Gradient (slope)", analysis.slope.toFixed(6)],
          ["Intercept", analysis.intercept.toFixed(6)],
          ["R^2", analysis.rSquared.toFixed(6)],
          ["Data points", String(analysis.points.length)],
        ] as const) {
          doc.setFont("helvetica", "bold").text(`${label}:`, margin, y);
          doc.setFont("courier").text(value, margin + 130, y);
          y += 15;
        }
        y += 12;

        doc.setFont("helvetica", "bold").text("Readings", margin, y);
        y += 15;
        doc.setFont("courier").setFontSize(9);
        doc.text(experiment.xLabel, margin, y);
        doc.text(experiment.yLabel, margin + 200, y);
        y += 13;
        for (const [x, yy] of analysis.points) {
          doc.text(String(x), margin, y);
          doc.text(String(yy), margin + 200, y);
          y += 12;
        }

        doc.save(`formulax-${experiment.key}-report.pdf`);
        notify("Report downloaded.", "success");
      } catch (caught) {
        console.error("[formulax] lab report", caught);
        notify("The report could not be generated in this browser.", "error");
      }
    })();
  }

  function onDelete(run: LabRunRow) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", run.id);
      const result = await deleteLabRunAction(formData);
      if (!result.success) {
        notify(result.error, "error");
        return;
      }
      setSavedRuns((current) => current.filter((item) => item.id !== run.id));
      notify("Run deleted.", "info");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="fx-card p-5" aria-labelledby="lab-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="lab-experiment" className="fx-label">
              Experiment preset
            </label>
            <select
              id="lab-experiment"
              value={experimentKey}
              onChange={(event) => onSelectExperiment(event.target.value)}
              className="fx-input fx-select max-w-md"
            >
              {LAB_EXPERIMENTS.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={loadSample}
            className="fx-btn fx-btn-secondary"
          >
            Load sample readings
          </button>
        </div>

        <p className="mt-3 text-sm text-ink-muted">{experiment.unitNote}</p>

        <div className="scrollbar-slim mt-4 overflow-x-auto">
          <table className="w-full min-w-md border-collapse text-sm">
            <caption className="sr-only">
              Experimental readings for {experiment.title}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="fx-label text-left">
                  {experiment.xLabel}
                </th>
                <th scope="col" className="fx-label text-left">
                  {experiment.yLabel}
                </th>
                <th scope="col" className="fx-label">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="py-1 pr-2">
                    <label htmlFor={`lab-x-${index}`} className="sr-only">
                      {experiment.xLabel} for row {index + 1}
                    </label>
                    <input
                      id={`lab-x-${index}`}
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={row.x}
                      onChange={(event) => {
                        const next = [...rows];
                        next[index] = { ...row, x: event.target.value };
                        setRows(next);
                      }}
                      className="fx-input font-mono"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <label htmlFor={`lab-y-${index}`} className="sr-only">
                      {experiment.yLabel} for row {index + 1}
                    </label>
                    <input
                      id={`lab-y-${index}`}
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={row.y}
                      onChange={(event) => {
                        const next = [...rows];
                        next[index] = { ...row, y: event.target.value };
                        setRows(next);
                      }}
                      className="fx-input font-mono"
                    />
                  </td>
                  <td className="py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                      disabled={rows.length <= 2}
                      aria-label={`Remove row ${index + 1}`}
                      className="fx-btn fx-btn-ghost px-2 text-danger disabled:opacity-40"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRows([...rows, { x: "", y: "" }])}
            className="fx-btn fx-btn-secondary"
          >
            Add row
          </button>
          <button type="button" onClick={onRun} className="fx-btn fx-btn-primary">
            Run least-squares analysis
          </button>
        </div>

        <div aria-live="polite" className="mt-4">
          {error ? <p className="fx-error">{error}</p> : null}

          {analysis ? (
            <>
              <div className="fx-result">
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Gradient", value: analysis.slope.toFixed(4) },
                    { label: "Intercept", value: analysis.intercept.toFixed(4) },
                    { label: "R^2", value: analysis.rSquared.toFixed(4) },
                    { label: "Points", value: String(analysis.points.length) },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-xs tracking-wide text-ink-muted uppercase">
                        {item.label}
                      </dt>
                      <dd className="mt-1 font-mono text-lg font-semibold text-accent">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm text-ink-muted">
                  {analysis.rSquared >= 0.99
                    ? "An R^2 this close to 1 means the relationship is very nearly linear over this range."
                    : analysis.rSquared >= 0.9
                      ? "A good but imperfect fit - check for outliers or a curved relationship."
                      : "A weak fit. Verify the readings and confirm the axes are the ones your model predicts."}
                </p>
              </div>

              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Scatter plot with best-fit line, gradient ${analysis.slope.toFixed(3)}`}
                className="mt-4 h-80 w-full rounded-input border border-line bg-surface-0"
              />

              <div className="mt-4 flex flex-col gap-3">
                <div className="max-w-md">
                  <label htmlFor="lab-title" className="fx-label">
                    Run title
                  </label>
                  <input
                    id="lab-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={160}
                    className="fx-input"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={isPending}
                    className="fx-btn fx-btn-primary"
                  >
                    {isPending ? "Saving..." : "Save to lab notebook"}
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadReport}
                    className="fx-btn fx-btn-secondary"
                  >
                    Download printable report
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="fx-card p-5" aria-labelledby="notebook-heading">
        <h2 id="notebook-heading" className="text-sm font-semibold">
          Lab notebook history
        </h2>

        {savedRuns.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Saved runs appear here, newest first, and follow your account across devices.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {savedRuns.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{run.title}</p>
                  <p className="truncate font-mono text-xs text-ink-faint">
                    {run.experiment_key} &middot; slope {run.slope.toFixed(4)} &middot; R&sup2;{" "}
                    {run.r_squared.toFixed(4)} &middot;{" "}
                    {new Date(run.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(run)}
                  disabled={isPending}
                  aria-label={`Delete run ${run.title}`}
                  className="fx-btn fx-btn-ghost px-2 text-danger disabled:opacity-50"
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
                    <path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

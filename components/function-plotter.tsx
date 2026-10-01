"use client";

import { useEffect, useRef, useState } from "react";

import { PlotExportButton } from "@/components/plot-export-button";
import { PLOT_PRESETS, compileFunction } from "@/lib/evaluate";

const EXPRESSION_HINT =
  "Use x as the variable, * for multiplication and ^ for powers, e.g. 2*x^2 + sin(x)";

const PLOT_HEIGHT = 400;

type PlotState =
  | { status: "idle" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function FunctionPlotter({
  initialExpression,
}: {
  initialExpression: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expression, setExpression] = useState(
    initialExpression ?? "sin(x) * exp(-0.2 * x)",
  );
  const [state, setState] = useState<PlotState>({ status: "idle" });
  const [ready, setReady] = useState(false);
  const [svgNode, setSvgNode] = useState<SVGSVGElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    // function-plot touches `window` and `document` at import time, so it is pulled in
    // only inside the browser effect that needs it.
    void (async () => {
      const { default: functionPlot } = await import("function-plot");
      if (disposed || !containerRef.current) {
        return;
      }

      const compiled = compileFunction(expression);
      if (!compiled.ok) {
        setState({ status: "error", message: compiled.error });
        return;
      }

      setState({ status: "ready" });

      const draw = () => {
        const container = containerRef.current;
        if (disposed || !container) {
          return;
        }
        const width = container.clientWidth;
        if (width === 0) {
          return;
        }
        container.replaceChildren();
        // The expression is passed as a function, not a string: function-plot's own
        // evaluator cannot express a discontinuity, so NaN is returned at singular
        // points (1/x at 0, sqrt at its domain edge) and the line breaks there instead
        // of aborting the whole plot.
        functionPlot({
          target: container,
          width,
          height: PLOT_HEIGHT,
          grid: true,
          data: [
            {
              fn: (scope: { x?: number }) =>
                typeof scope.x === "number" ? compiled.fn(scope.x) : Number.NaN,
              color: "#4f5ce0",
              graphType: "polyline",
            },
          ],
        });
      };

      draw();
      setSvgNode(containerRef.current?.querySelector("svg") ?? null);
      setReady(true);

      // function-plot exposes no `resize()`, so a ResizeObserver re-draws instead.
      const observer = new ResizeObserver(() => draw());
      observer.observe(containerRef.current);

      cleanup = () => {
        observer.disconnect();
        containerRef.current?.replaceChildren();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [expression]);

  return (
    <section className="fx-card p-5" aria-labelledby="plotter-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="plotter-heading" className="text-sm font-semibold">
            2D Cartesian plotter
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{EXPRESSION_HINT}</p>
        </div>
        <PlotExportButton
          svg={svgNode}
          expression={expression}
          background="var(--color-plot)"
          ink="var(--color-plot-ink)"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="plot-expression" className="fx-label">
          f(x)
        </label>
        <input
          id="plot-expression"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          spellCheck={false}
          aria-invalid={state.status === "error" ? true : undefined}
          aria-describedby={state.status === "error" ? "plot-error" : undefined}
          className={`fx-input font-mono ${state.status === "error" ? "fx-input-invalid" : ""}`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PLOT_PRESETS.map((preset) => (
          <button
            key={preset.expression}
            type="button"
            onClick={() => setExpression(preset.expression)}
            aria-pressed={expression === preset.expression}
            className={`fx-chip ${expression === preset.expression ? "fx-chip-active" : ""}`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {state.status === "error" ? (
        <p id="plot-error" role="alert" className="fx-error mt-4">
          {state.message}
        </p>
      ) : null}

      <div className="fx-plot mt-4">
        <div
          ref={containerRef}
          style={{ minHeight: PLOT_HEIGHT }}
          aria-label={`Plot of ${expression}`}
          role="img"
        />
        {!ready && state.status !== "error" ? (
          <p className="flex items-center justify-center py-24 text-sm">
            Loading plotter&hellip;
          </p>
        ) : null}
      </div>
    </section>
  );
}

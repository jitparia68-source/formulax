import { all, create, type MathJsInstance } from "mathjs/number";

const math: MathJsInstance = create(all, { number: "number" });

export type EvaluationResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/**
 * Evaluates a solver expression from `solver_meta.solve` over the supplied variables.
 * mathjs' `evaluate` is typed as returning `any`, so the result is narrowed to a finite
 * number here - an unguarded value could reach React state and render as `NaN`.
 */
export function evaluateExpression(
  expression: string,
  scope: Readonly<Record<string, number>>,
): EvaluationResult {
  let raw: unknown;
  try {
    raw = math.evaluate(expression, { ...scope });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      error: `Could not evaluate that equation: ${message.split("\n")[0]}`,
    };
  }

  if (typeof raw === "boolean") {
    return { ok: false, error: "That expression did not produce a number." };
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    return {
      ok: false,
      error: "The inputs do not produce a real result for this equation.",
    };
  }
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      error: "The inputs cause a division by zero.",
    };
  }

  return { ok: true, value };
}

/**
 * Parses a function expression for the plotter. Compiles once, then reports per-sample
 * errors so a vertical asymptote is drawn as a gap instead of aborting the whole plot.
 */
export function compileFunction(
  expression: string,
): { ok: true; fn: (x: number) => number } | { ok: false; error: string } {
  try {
    const compiled = math.compile(expression);
    return {
      ok: true,
      fn: (x: number) => {
        const result: unknown = compiled.evaluate({ x });
        const value = Number(result);
        return Number.isFinite(value) ? value : Number.NaN;
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      error: `Invalid expression: ${message.split("\n")[0]}`,
    };
  }
}

export const PLOT_PRESETS: readonly { label: string; expression: string }[] = [
  { label: "Parabola", expression: "x^2" },
  { label: "Sine wave", expression: "sin(x)" },
  { label: "Cubic", expression: "x^3 - 3 * x" },
  { label: "Upper circle", expression: "sqrt(25 - x^2)" },
  { label: "Damped decay", expression: "sin(x) * exp(-0.2 * x)" },
  { label: "Rational", expression: "1 / (1 + x^2)" },
];

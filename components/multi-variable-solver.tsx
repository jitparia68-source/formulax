"use client";

import { useMemo, useState } from "react";

import { MathFormula } from "@/components/math-formula";
import { evaluateExpression } from "@/lib/evaluate";
import type { FormulaRow } from "@/types/database";

type Props = {
  formulas: FormulaRow[];
};

type Challenge = {
  formula: FormulaRow;
  target: string;
  values: Record<string, number>;
  answer: number;
  working: string;
};

function isSolvable(formula: FormulaRow): boolean {
  const meta = formula.solver_meta;
  return Boolean(
    meta &&
      Object.keys(meta.vars).length >= 2 &&
      Object.keys(meta.solve).length >= 1,
  );
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(6)));
}

function buildChallenge(formulas: FormulaRow[]): Challenge | null {
  const pool = formulas.filter(isSolvable);
  if (pool.length === 0) {
    return null;
  }

  const formula = pool[Math.floor(Math.random() * pool.length)];
  const meta = formula.solver_meta!;
  const variables = Object.keys(meta.vars);
  const target = variables[Math.floor(Math.random() * variables.length)];
  const others = variables.filter((variable) => variable !== target);

  const values: Record<string, number> = {};
  for (const variable of others) {
    // Ranges chosen per variable so the result is physically sensible rather than absurd:
    // a resistance of 4.7 ohm or a mass of 0.002 kg both read as real lab values.
    switch (variable) {
      case "I":
        values[variable] = Number((0.1 + Math.random() * 4.9).toFixed(2));
        break;
      case "R":
        values[variable] = Number((10 + Math.random() * 990).toFixed(1));
        break;
      case "V":
        values[variable] = Number((1 + Math.random() * 48).toFixed(2));
        break;
      case "P":
        values[variable] = Number((5 + Math.random() * 495).toFixed(1));
        break;
      case "m":
        values[variable] = Number((0.1 + Math.random() * 9.9).toFixed(2));
        break;
      case "a":
        values[variable] = Number((0.5 + Math.random() * 9.5).toFixed(2));
        break;
      case "v":
        values[variable] = Number((1 + Math.random() * 29).toFixed(2));
        break;
      case "L":
        values[variable] = Number((0.0005 + Math.random() * 0.01).toExponential(2));
        break;
      case "C":
        values[variable] = Number((1e-7 + Math.random() * 1e-5).toExponential(2));
        break;
      case "f":
        values[variable] = Number((1000 + Math.random() * 9000).toFixed(0));
        break;
      case "KE":
        values[variable] = Number((10 + Math.random() * 990).toFixed(1));
        break;
      default:
        values[variable] = Number((1 + Math.random() * 9).toFixed(2));
    }
  }

  const result = evaluateExpression(meta.solve[target], values);
  if (!result.ok) {
    return null;
  }

  const scopeText = others
    .map((variable) => `${variable} = ${formatNumber(values[variable])}`)
    .join(", ");

  return {
    formula,
    target,
    values,
    answer: result.value,
    working: `${meta.solve[target]}\nwith ${scopeText}\n= ${formatNumber(result.value)}`,
  };
}

export function MultiVariableSolver({ formulas }: Props) {
  const solvable = useMemo(() => formulas.filter(isSolvable), [formulas]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    solvable[0]?.slug ?? null,
  );
  const [target, setTarget] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<
    { ok: true; value: number } | { ok: false; error: string } | null
  >(null);

  const selected = solvable.find((f) => f.slug === selectedSlug) ?? null;
  const meta = selected?.solver_meta ?? null;
  const variables = meta ? Object.keys(meta.vars) : [];
  const effectiveTarget =
    target && variables.includes(target) ? target : (variables[0] ?? null);
  const knownVariables = effectiveTarget
    ? variables.filter((variable) => variable !== effectiveTarget)
    : [];

  if (solvable.length === 0) {
    return (
      <p className="fx-empty">No solvable formulas are available yet.</p>
    );
  }

  function onFormulaChange(slug: string) {
    setSelectedSlug(slug);
    setTarget(null);
    setInputs({});
    setResult(null);
  }

  function onTargetChange(next: string) {
    setTarget(next);
    setResult(null);
  }

  function onSolve() {
    if (!meta || !effectiveTarget) {
      return;
    }
    const scope: Record<string, number> = {};
    for (const variable of knownVariables) {
      const parsed = Number(inputs[variable]);
      if (inputs[variable] === undefined || inputs[variable].trim() === "") {
        setResult({ ok: false, error: `Enter a value for ${meta.vars[variable]}.` });
        return;
      }
      if (!Number.isFinite(parsed)) {
        setResult({
          ok: false,
          error: `${meta.vars[variable]} must be a number.`,
        });
        return;
      }
      scope[variable] = parsed;
    }
    setResult(evaluateExpression(meta.solve[effectiveTarget], scope));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="fx-card p-5" aria-labelledby="solver-heading">
        <h2 id="solver-heading" className="text-sm font-semibold">
          Multi-variable solver
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Supply the known quantities and solve the equation for the one you pick.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="solver-formula" className="fx-label">
              Equation
            </label>
            <select
              id="solver-formula"
              value={selectedSlug ?? ""}
              onChange={(event) => onFormulaChange(event.target.value)}
              className="fx-input fx-select"
            >
              {solvable.map((formula) => (
                <option key={formula.slug} value={formula.slug}>
                  {formula.category} &mdash; {formula.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="solver-target" className="fx-label">
              Solve for
            </label>
            <select
              id="solver-target"
              value={effectiveTarget ?? ""}
              onChange={(event) => onTargetChange(event.target.value)}
              className="fx-input fx-select"
            >
              {variables.map((variable) => (
                <option key={variable} value={variable}>
                  {meta?.vars[variable]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selected ? (
          <div className="mt-4">
            <MathFormula latex={selected.latex} />
            <p className="mt-2 text-sm text-ink-muted">{selected.description}</p>
          </div>
        ) : null}

        <fieldset className="mt-4">
          <legend className="fx-label">Known values</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {knownVariables.map((variable) => (
              <div key={variable}>
                <label htmlFor={`solver-${variable}`} className="fx-label">
                  {meta?.vars[variable]}
                </label>
                <input
                  id={`solver-${variable}`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={inputs[variable] ?? ""}
                  onChange={(event) =>
                    setInputs((current) => ({
                      ...current,
                      [variable]: event.target.value,
                    }))
                  }
                  className="fx-input font-mono"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={onSolve}
          className="fx-btn fx-btn-primary mt-4"
        >
          Calculate result
        </button>

        <div aria-live="polite" className="mt-4">
          {result?.ok ? (
            <div className="fx-result">
              <p className="fx-eyebrow">
                {meta?.vars[effectiveTarget ?? ""]}
              </p>
              <p className="fx-value mt-1 text-2xl text-secondary">
                {result.value.toFixed(4)}
              </p>
            </div>
          ) : null}
          {result && !result.ok ? <p className="fx-error">{result.error}</p> : null}
        </div>
      </section>

      <ChallengePanel formulas={formulas} />
    </div>
  );
}

function ChallengePanel({ formulas }: Props) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<
    { kind: "correct" } | { kind: "wrong"; expected: number } | null
  >(null);
  const [showWorking, setShowWorking] = useState(false);

  function next() {
    setChallenge(buildChallenge(formulas));
    setAnswer("");
    setVerdict(null);
    setShowWorking(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) {
      return;
    }
    const parsed = Number(answer);
    if (!Number.isFinite(parsed)) {
      return;
    }
    // Relative tolerance, so rounding the displayed value is not scored as wrong.
    const tolerance = Math.max(Math.abs(challenge.answer) * 1e-3, 1e-6);
    setVerdict(
      Math.abs(parsed - challenge.answer) <= tolerance
        ? { kind: "correct" }
        : { kind: "wrong", expected: challenge.answer },
    );
  }

  return (
    <section className="fx-card p-5" aria-labelledby="challenge-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="challenge-heading" className="text-sm font-semibold">
          Random formula challenge
        </h2>
        <button type="button" onClick={next} className="fx-btn fx-btn-secondary">
          {challenge ? "New problem" : "Generate problem"}
        </button>
      </div>

      {!challenge ? (
        <p className="mt-3 text-sm text-ink-muted">
          Generate a problem to test whether you can solve a formula without a calculator.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-ink">
            Solve <span className="font-medium">{challenge.formula.title}</span> for{" "}
            <span className="font-medium">
              {challenge.formula.solver_meta?.vars[challenge.target]}
            </span>
            .
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(challenge.values).map(([variable, value]) => (
              <div key={variable} className="rounded-input border border-line bg-surface-1 px-3 py-2">
                <p className="text-xs text-ink-muted">
                  {challenge.formula.solver_meta?.vars[variable]}
                </p>
                <p className="font-mono text-sm text-ink">{formatNumber(value)}</p>
              </div>
            ))}
          </div>

          <div className="max-w-xs">
            <label htmlFor="challenge-answer" className="fx-label">
              Your answer
            </label>
            <input
              id="challenge-answer"
              type="number"
              step="any"
              inputMode="decimal"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="fx-input font-mono"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="fx-btn fx-btn-primary">
              Check answer
            </button>
            <button
              type="button"
              onClick={() => setShowWorking((value) => !value)}
              aria-expanded={showWorking}
              className="fx-btn fx-btn-ghost"
            >
              {showWorking ? "Hide working" : "Show working"}
            </button>
          </div>

          <div aria-live="polite">
            {verdict?.kind === "correct" ? (
              <p className="rounded-input border border-success/40 bg-success/12 px-4 py-3 text-sm text-success">
                Correct.
              </p>
            ) : null}
            {verdict?.kind === "wrong" ? (
              <p className="fx-error">
                Not quite &mdash; the expected value is{" "}
                <span className="font-mono">{verdict.expected.toFixed(4)}</span>.
              </p>
            ) : null}
            {showWorking ? (
              <pre className="fx-result scrollbar-slim overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                {challenge.working}
              </pre>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}

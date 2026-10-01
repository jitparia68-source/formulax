"use client";

import { useState } from "react";

import { MathFormula } from "@/components/math-formula";
import {
  PolynomialParseError,
  differentiatePolynomial,
  type DifferentiationResult,
} from "@/lib/polynomial";

const EXAMPLES = ["3x^3 - 4x^2 + 2x - 7", "x^4 - 1", "2.5x^2 - 1.25x + 4", "-x^3 + 6x"];

export function DerivativeCalculator() {
  const [expression, setExpression] = useState(EXAMPLES[0]!);
  const [result, setResult] = useState<DifferentiationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function differentiate() {
    try {
      setResult(differentiatePolynomial(expression));
      setError(null);
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof PolynomialParseError
          ? caught.message
          : "Could not read that expression.",
      );
    }
  }

  return (
    <section className="fx-card p-5" aria-labelledby="derivative-heading">
      <h2 id="derivative-heading" className="text-sm font-semibold">
        Polynomial derivative
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Applies the power rule term by term. Supports integer and decimal coefficients in
        plain ASCII notation, e.g. <code className="font-mono">3x^3 - 4x^2 + 2x - 7</code>.
      </p>

      <div className="mt-4">
        <label htmlFor="polynomial" className="fx-label">
          f(x)
        </label>
        <input
          id="polynomial"
          value={expression}
          onChange={(event) => {
            setExpression(event.target.value);
            setResult(null);
            setError(null);
          }}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "derivative-error" : undefined}
          className={`fx-input font-mono ${error ? "fx-input-invalid" : ""}`}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              differentiate();
            }
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setExpression(example);
              setError(null);
            }}
            className="fx-chip"
          >
            {example}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={differentiate}
        className="fx-btn fx-btn-primary mt-4"
      >
        Differentiate with respect to x
      </button>

      <div aria-live="polite" className="mt-4">
        {error ? (
          <p id="derivative-error" role="alert" className="fx-error">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="fx-result">
            <p className="text-xs tracking-wide text-ink-muted uppercase">
              f&prime;(x)
            </p>
            <MathFormula latex={result.latex} className="mt-2" />
            <ol className="mt-4 flex list-decimal flex-col gap-1 pl-5 font-mono text-xs text-ink-muted">
              {result.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}

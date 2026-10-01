"use client";

import { useState } from "react";

import { MathFormula } from "@/components/math-formula";
import { determinant3, type Matrix3 } from "@/lib/determinant";

const IDENTITY: Matrix3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function toMatrix(values: number[]): Matrix3 {
  return [
    [values[0]!, values[1]!, values[2]!],
    [values[3]!, values[4]!, values[5]!],
    [values[6]!, values[7]!, values[8]!],
  ];
}

export function MatrixCalculator() {
  const [values, setValues] = useState<number[]>(() => IDENTITY.flat());
  const [result, setResult] = useState<ReturnType<typeof determinant3> | null>(null);

  function update(index: number, raw: string) {
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setValues((current) => {
      const next = [...current];
      next[index] = parsed;
      return next;
    });
    setResult(null);
  }

  return (
    <section className="fx-card p-5" aria-labelledby="matrix-heading">
      <h2 id="matrix-heading" className="text-sm font-semibold">
        3&times;3 matrix properties
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Enter the nine entries to see the determinant expanded step by step along the first
        row.
      </p>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div>
          <div
            role="group"
            aria-label="Matrix entries"
            className="grid grid-cols-3 gap-2"
          >
            {values.map((value, index) => (
              <div key={index}>
                <label htmlFor={`m${index}`} className="sr-only">
                  Row {Math.floor(index / 3) + 1}, column {(index % 3) + 1}
                </label>
                <input
                  id={`m${index}`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={value}
                  onChange={(event) => update(index, event.target.value)}
                  className="fx-input w-20 text-center font-mono"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setResult(determinant3(toMatrix(values)));
              }}
              className="fx-btn fx-btn-primary"
            >
              Calculate determinant
            </button>
            <button
              type="button"
              onClick={() => {
                setValues(IDENTITY.flat());
                setResult(null);
              }}
              className="fx-btn fx-btn-secondary"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setValues(new Array(9).fill(0));
                setResult(null);
              }}
              className="fx-btn fx-btn-ghost"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1" aria-live="polite">
          {result ? (
            <div className="fx-result">
              <p className="fx-eyebrow">Determinant</p>
              <p className="fx-value mt-1 text-2xl text-secondary">
                {result.determinant.toFixed(4)}
              </p>
              {result.determinant === 0 ? (
                <p className="mt-1 text-xs text-ink-muted">
                  A zero determinant means the matrix is singular and cannot be inverted.
                </p>
              ) : null}
              <MathFormula
                latex={`\\det = ${result.determinant}`}
                className="mt-3"
              />
              <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 font-mono text-xs text-ink-muted">
                {result.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="fx-empty">Enter the matrix entries, then calculate.</p>
          )}
        </div>
      </div>
    </section>
  );
}

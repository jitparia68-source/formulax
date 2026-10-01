export type PolynomialTerm = {
  /** Signed coefficient. */
  coefficient: number;
  /** Non-negative integer exponent; a constant term is 0. */
  exponent: number;
};

export type DifferentiationResult = {
  terms: PolynomialTerm[];
  latex: string;
  steps: string[];
};

export class PolynomialParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolynomialParseError";
  }
}

// One term: an optional sign, an optional numeric coefficient, and either `x` (with an
// optional `^n` exponent) or a bare constant. Every accepted token is accounted for
// against the input length, so a stray character is a hard error rather than a silently
// dropped term.
const TERM_PATTERN =
  /([+-]?)\s*(\d+(?:\.\d+)?)?\s*\*?\s*(?:x(?:\^\s*(\d+))?|(\d+(?:\.\d+)?))/gi;

/**
 * Parses a single-variable polynomial written in plain ASCII math notation, e.g.
 * `3x^3 - 4x^2 + 2.5x - 7`. The prototype's parser discarded decimal coefficients
 * (`parseFloat("-4x^2")` is NaN) and silently dropped unparseable terms, so malformed
 * input produced a wrong derivative instead of an error.
 */
export function parsePolynomial(expression: string): PolynomialTerm[] {
  const input = expression.replace(/\s+/g, "").replace(/\*/g, "");
  if (input.length === 0) {
    throw new PolynomialParseError("Enter a polynomial expression.");
  }
  if (!/^[-+.\dx^]+$/.test(input)) {
    throw new PolynomialParseError(
      "Only numbers, x, ^, + and - are supported in a polynomial.",
    );
  }
  // A term may be introduced by a sign, but a sign may not follow a sign and may not
  // terminate the expression.
  if (/[-+]{2,}/.test(input) || /[-+]$/.test(input)) {
    throw new PolynomialParseError("Check the signs in your expression.");
  }

  const terms: PolynomialTerm[] = [];
  let consumed = 0;
  let match: RegExpExecArray | null;

  TERM_PATTERN.lastIndex = 0;
  while ((match = TERM_PATTERN.exec(input)) !== null) {
    const [raw, sign, rawCoefficient, rawExponent, rawConstant] = match;
    const isConstant = rawConstant !== undefined;
    const magnitude =
      rawCoefficient !== undefined
        ? Number(rawCoefficient)
        : isConstant
          ? Number(rawConstant)
          : 1;
    if (!Number.isFinite(magnitude)) {
      throw new PolynomialParseError(`Could not read the coefficient in "${raw}".`);
    }
    terms.push({
      coefficient: sign === "-" ? -magnitude : magnitude,
      exponent: isConstant ? 0 : rawExponent ? Number(rawExponent) : 1,
    });
    consumed += raw.length;
  }

  if (terms.length === 0) {
    throw new PolynomialParseError("No terms of x were found in that expression.");
  }
  // Anything the term pattern skipped means the input is not a clean term list.
  if (consumed !== input.length) {
    throw new PolynomialParseError("That expression is not a valid polynomial.");
  }

  return terms;
}

function formatCoefficient(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

export function combineLikeTerms(terms: readonly PolynomialTerm[]): PolynomialTerm[] {
  const byExponent = new Map<number, number>();
  for (const term of terms) {
    byExponent.set(term.exponent, (byExponent.get(term.exponent) ?? 0) + term.coefficient);
  }
  return [...byExponent.entries()]
    .filter(([, coefficient]) => coefficient !== 0)
    .sort((a, b) => b[0] - a[0])
    .map(([exponent, coefficient]) => ({ coefficient, exponent }));
}

export function polynomialToLatex(terms: readonly PolynomialTerm[]): string {
  if (terms.length === 0) {
    return "0";
  }
  return terms
    .map((term, index) => {
      const { coefficient, exponent } = term;
      const sign = coefficient < 0 ? "-" : index === 0 ? "" : "+";
      const magnitude = Math.abs(coefficient);

      if (exponent === 0) {
        return `${sign}${formatCoefficient(magnitude)}`;
      }
      const coefficientPart = magnitude === 1 ? "" : formatCoefficient(magnitude);
      const variablePart = exponent === 1 ? "x" : `x^{${exponent}}`;
      return `${sign}${coefficientPart}${variablePart}`;
    })
    .join("");
}

/** Applies the power rule term by term, dropping constants. */
export function differentiatePolynomial(
  expression: string,
): DifferentiationResult {
  const terms = parsePolynomial(expression);
  const steps: string[] = [];
  const derivativeTerms: PolynomialTerm[] = [];

  for (const term of terms) {
    if (term.exponent === 0) {
      steps.push(
        `d/dx(${formatCoefficient(term.coefficient)}) = 0 - constant drops out`,
      );
      continue;
    }
    const nextCoefficient = term.coefficient * term.exponent;
    const nextExponent = term.exponent - 1;
    derivativeTerms.push({
      coefficient: nextCoefficient,
      exponent: nextExponent,
    });
    steps.push(
      `d/dx(${polynomialToLatex([term])}) = ${formatCoefficient(term.coefficient)}*${term.exponent}x^${term.exponent - 1} = ${polynomialToLatex([{ coefficient: nextCoefficient, exponent: nextExponent }])}`,
    );
  }

  const combined = combineLikeTerms(derivativeTerms);

  if (combined.length === 0) {
    steps.push("Every term was a constant, so the derivative is 0.");
  }

  return {
    terms: combined,
    latex: polynomialToLatex(combined),
    steps,
  };
}

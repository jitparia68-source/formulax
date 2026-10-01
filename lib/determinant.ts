export type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export type DeterminantResult = {
  determinant: number;
  /** Cofactor expansion along the first row, for the step-by-step view. */
  steps: string[];
};

/** Adjugate (transpose of the cofactor matrix) of a 3x3, for the inverse. */
export function adjugate3(matrix: Matrix3): Matrix3 {
  const [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ] = matrix;
  return [
    [e * i - f * h, c * h - b * i, b * f - c * e],
    [f * g - d * i, a * i - c * g, c * d - a * f],
    [d * h - e * g, b * g - a * h, a * e - b * d],
  ];
}

export function determinant3(matrix: Matrix3): DeterminantResult {
  const [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ] = matrix;
  const m = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

  const m1 = e * i - f * h;
  const m2 = d * i - f * g;
  const m3 = d * h - e * g;

  const determinant = a * m1 - b * m2 + c * m3;

  return {
    determinant,
    steps: [
      `Expand along the first row: det = a(ei - fh) - b(di - fg) + c(dh - eg)`,
      `a = ${m(a)}, b = ${m(b)}, c = ${m(c)}, d = ${m(d)}, e = ${m(e)}, f = ${m(f)}, g = ${m(g)}, h = ${m(h)}, i = ${m(i)}`,
      `ei - fh = (${m(e)})(${m(i)}) - (${m(f)})(${m(h)}) = ${m(m1)}`,
      `di - fg = (${m(d)})(${m(i)}) - (${m(f)})(${m(g)}) = ${m(m2)}`,
      `dh - eg = (${m(d)})(${m(h)}) - (${m(e)})(${m(g)}) = ${m(m3)}`,
      `det = (${m(a)})(${m(m1)}) - (${m(b)})(${m(m2)}) + (${m(c)})(${m(m3)})`,
      `det = ${m(determinant)}`,
    ],
  };
}

/** Inverse via the adjugate. Returns null for a singular matrix. */
export function inverse3(matrix: Matrix3): Matrix3 | null {
  const { determinant } = determinant3(matrix);
  if (determinant === 0) {
    return null;
  }
  const adj = adjugate3(matrix);
  return adj.map((row) => row.map((value) => value / determinant)) as unknown as Matrix3;
}

/** Solve A x = b for a 3x3 system. Returns null when A is singular. */
export function solve3(matrix: Matrix3, rhs: readonly [number, number, number]) {
  const inverse = inverse3(matrix);
  if (!inverse) {
    return null;
  }
  return [
    inverse[0][0] * rhs[0] + inverse[0][1] * rhs[1] + inverse[0][2] * rhs[2],
    inverse[1][0] * rhs[0] + inverse[1][1] * rhs[1] + inverse[1][2] * rhs[2],
    inverse[2][0] * rhs[0] + inverse[2][1] * rhs[1] + inverse[2][2] * rhs[2],
  ];
}

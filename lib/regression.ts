export type LinearRegression = {
  slope: number;
  intercept: number;
  rSquared: number;
  meanX: number;
  meanY: number;
};

/**
 * Ordinary least squares for y = slope * x + intercept, plus the coefficient of
 * determination. The prototype SPA only ever reported slope and intercept even though
 * the `lab_runs` table requires `r_squared`, so the value has to be derived here.
 */
export function linearRegression(
  points: readonly (readonly [number, number])[],
): LinearRegression | null {
  const n = points.length;
  if (n < 2) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    sumX += x;
    sumY += y;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of points) {
    const dx = x - meanX;
    const dy = y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  // A vertical set of points has no defined slope; NaN propagates rather than dividing
  // by zero, and callers surface it as an unusable dataset.
  const slope = sxx === 0 ? Number.NaN : sxy / sxx;
  const intercept = meanY - slope * meanX;

  // A perfectly flat y series has zero total variance, so R-squared is conventionally 1 when
  // the fit is also exact, and undefined otherwise. Guard both to avoid NaN in the DB.
  let rSquared: number;
  if (syy === 0) {
    rSquared = sxy === 0 ? 1 : 0;
  } else {
    rSquared = (sxy * sxy) / (sxx * syy);
  }

  if (!Number.isFinite(slope) || !Number.isFinite(rSquared)) {
    return null;
  }

  return { slope, intercept, rSquared, meanX, meanY };
}

export function predict(regression: LinearRegression, x: number): number {
  return regression.slope * x + regression.intercept;
}

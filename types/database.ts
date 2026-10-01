export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type FormulaCategory =
  | "Calculus"
  | "Linear Algebra"
  | "Electrical"
  | "Physics"
  | "Thermodynamics";

/**
 * Solver metadata. `solve` maps a target variable to a mathjs-parseable expression over
 * the remaining variables - JSON cannot carry the JS closures the SPA reference used.
 */
export type SolverMeta = {
  vars: Record<string, string>;
  solve: Record<string, string>;
};

export type FormulaRow = {
  id: string;
  user_id: string | null;
  slug: string;
  title: string;
  category: string;
  latex: string;
  description: string;
  reference_url: string | null;
  solver_meta: SolverMeta | null;
  is_custom: boolean;
  created_at: string;
};

export type SavedBookmarkRow = {
  id: string;
  user_id: string;
  formula_id: string;
  created_at: string;
};

export type LabRunRow = {
  id: string;
  user_id: string;
  experiment_key: string;
  title: string;
  readings: number[][];
  slope: number;
  r_squared: number;
  created_at: string;
};

export const FORMULA_CATEGORIES: readonly FormulaCategory[] = [
  "Calculus",
  "Linear Algebra",
  "Electrical",
  "Physics",
  "Thermodynamics",
];

export function isFormulaCategory(value: string): value is FormulaCategory {
  return (FORMULA_CATEGORIES as readonly string[]).includes(value);
}

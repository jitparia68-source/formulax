"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabase";
import {
  isFormulaCategory,
  type FormulaRow,
  type LabRunRow,
} from "@/types/database";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

const POSTGRES_UNIQUE_VIOLATION = "23505";
const REFERENCE_URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const MAX_LAB_READINGS = 500;
const FORMULA_CATEGORIES = [
  "Calculus",
  "Linear Algebra",
  "Electrical",
  "Physics",
  "Thermodynamics",
] as const;

/**
 * Database and auth failures must not reach the client verbatim: PostgREST messages leak
 * schema details and constraint names. The real cause is logged server-side instead.
 */
function toClientError(context: string, error: unknown): string {
  console.error(`[formulax] ${context}`, error);
  return "Something went wrong. Please try again.";
}

async function requireUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateLatex(latex: string): boolean {
  return latex.length <= 4000;
}

function validateDescription(description: string): boolean {
  return description.length <= 2000;
}

function validateReferenceUrl(url: string): boolean {
  return url.length <= 2048 && REFERENCE_URL_PATTERN.test(url);
}

export async function addCustomFormulaAction(
  formData: FormData,
): Promise<ActionResult<{ slug: string }>> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: "You must be signed in." };
  }

  const title = readString(formData, "title");
  const category = readString(formData, "category");
  const latex = readString(formData, "latex");
  const description = readString(formData, "description");
  const referenceUrl = readString(formData, "referenceUrl");

  if (title.length < 1 || title.length > 160) {
    return { success: false, error: "Enter a title between 1 and 160 characters." };
  }
  if (!isFormulaCategory(category) || !FORMULA_CATEGORIES.includes(category as never)) {
    return { success: false, error: "Choose a valid category." };
  }
  if (!latex) {
    return { success: false, error: "Enter a LaTeX expression." };
  }
  if (!validateLatex(latex)) {
    return { success: false, error: "LaTeX expression is too long." };
  }
  if (description.length < 1) {
    return { success: false, error: "Enter a short description." };
  }
  if (!validateDescription(description)) {
    return { success: false, error: "Description is too long." };
  }
  if (referenceUrl && !validateReferenceUrl(referenceUrl)) {
    return { success: false, error: "Reference must be a valid http(s) URL." };
  }

  const { data, error } = await supabaseAdmin
    .from("formulas")
    .insert({
      user_id: userId,
      title,
      category,
      latex,
      description,
      reference_url: referenceUrl || null,
      is_custom: true,
    })
    .select("slug")
    .single<{ slug: string }>();

  if (error || !data) {
    return { success: false, error: toClientError("add formula", error) };
  }

  revalidatePath("/formulas");
  revalidatePath("/dashboard");
  return { success: true, data: { slug: data.slug } };
}

export async function deleteCustomFormulaAction(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: "You must be signed in." };
  }

  const slug = readString(formData, "slug");
  if (!slug) {
    return { success: false, error: "Missing formula reference." };
  }

  // Scoping the delete by user_id makes this safe: a slug belonging to another user (or
  // a seeded baseline formula) matches zero rows instead of being removed.
  const { error } = await supabaseAdmin
    .from("formulas")
    .delete()
    .eq("slug", slug)
    .eq("user_id", userId)
    .eq("is_custom", true);

  if (error) {
    return { success: false, error: toClientError("delete formula", error) };
  }

  revalidatePath("/formulas");
  revalidatePath("/cheatsheet");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function toggleBookmarkAction(
  formulaId: string,
): Promise<ActionResult<{ bookmarked: boolean }>> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: "You must be signed in." };
  }

  const slug = formulaId?.trim();
  if (!slug) {
    return { success: false, error: "Missing formula reference." };
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("saved_bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("formula_id", slug)
    .maybeSingle<{ id: string }>();

  if (lookupError) {
    return { success: false, error: toClientError("read bookmark", lookupError) };
  }

  if (existing) {
    const { error } = await supabaseAdmin
      .from("saved_bookmarks")
      .delete()
      .eq("id", existing.id)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: toClientError("remove bookmark", error) };
    }

    revalidatePath("/formulas");
    revalidatePath("/cheatsheet");
    revalidatePath("/dashboard");
    return { success: true, data: { bookmarked: false } };
  }

  const { error } = await supabaseAdmin.from("saved_bookmarks").insert({
    user_id: userId,
    formula_id: slug,
  });

  if (error) {
    // A double-submit can race past the lookup; the unique constraint means the
    // bookmark exists, which is the state the caller asked for.
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      revalidatePath("/formulas");
      revalidatePath("/cheatsheet");
      return { success: true, data: { bookmarked: true } };
    }
    if (error.code === "23503") {
      return { success: false, error: "That formula no longer exists." };
    }
    return { success: false, error: toClientError("add bookmark", error) };
  }

  revalidatePath("/formulas");
  revalidatePath("/cheatsheet");
  revalidatePath("/dashboard");
  return { success: true, data: { bookmarked: true } };
}

export type SaveLabRunInput = {
  experimentKey: string;
  title: string;
  readings: number[][];
  slope: number;
  rSquared: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateReadings(readings: unknown): readings is number[][] {
  if (!Array.isArray(readings) || readings.length < 2) {
    return false;
  }
  if (readings.length > MAX_LAB_READINGS) {
    return false;
  }
  return readings.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 2 &&
      isFiniteNumber(row[0]) &&
      isFiniteNumber(row[1]),
  );
}

export async function saveLabRunAction(
  input: SaveLabRunInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: "You must be signed in." };
  }

  const experimentKey = input.experimentKey?.trim() ?? "";
  const title = input.title?.trim() ?? "";

  if (experimentKey.length < 1 || experimentKey.length > 80) {
    return { success: false, error: "Choose a valid experiment." };
  }
  if (title.length < 1 || title.length > 160) {
    return { success: false, error: "Enter a title between 1 and 160 characters." };
  }
  if (!validateReadings(input.readings)) {
    return {
      success: false,
      error: "Recordings must be at least two finite x/y pairs.",
    };
  }
  if (!isFiniteNumber(input.slope) || !isFiniteNumber(input.rSquared)) {
    return { success: false, error: "Regression results are not valid numbers." };
  }
  if (input.rSquared < 0 || input.rSquared > 1) {
    return { success: false, error: "R-squared must be between 0 and 1." };
  }

  const { data, error } = await supabaseAdmin
    .from("lab_runs")
    .insert({
      user_id: userId,
      experiment_key: experimentKey,
      title,
      readings: input.readings,
      slope: input.slope,
      r_squared: input.rSquared,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { success: false, error: toClientError("save lab run", error) };
  }

  revalidatePath("/labcoach");
  revalidatePath("/dashboard");
  return { success: true, data: { id: data.id } };
}

export async function deleteLabRunAction(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: "You must be signed in." };
  }

  const id = readString(formData, "id");
  if (!id) {
    return { success: false, error: "Missing run reference." };
  }

  const { error } = await supabaseAdmin
    .from("lab_runs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { success: false, error: toClientError("delete lab run", error) };
  }

  revalidatePath("/labcoach");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export type UserData = {
  /** Seeded reference content, shared by every user. */
  baselineFormulas: FormulaRow[];
  /** Formulas this user added themselves. */
  customFormulas: FormulaRow[];
  /** Baseline + custom, which is what the vault and solver actually render. */
  allFormulas: FormulaRow[];
  bookmarks: string[];
  labRuns: LabRunRow[];
  totalFormulas: number;
};

export async function getUserData(): Promise<UserData | null> {
  const userId = await requireUserId();
  if (!userId) {
    return null;
  }

  const [formulasResult, customResult, bookmarksResult, labRunsResult, totalResult] =
    await Promise.all([
      supabaseAdmin
        .from("formulas")
        .select("id, user_id, slug, title, category, latex, description, reference_url, solver_meta, is_custom, created_at")
        .is("is_custom", false)
        .order("title", { ascending: true }),
      supabaseAdmin
        .from("formulas")
        .select("id, user_id, slug, title, category, latex, description, reference_url, solver_meta, is_custom, created_at")
        .eq("user_id", userId)
        .eq("is_custom", true)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("saved_bookmarks")
        .select("formula_id")
        .eq("user_id", userId),
      supabaseAdmin
        .from("lab_runs")
        .select("id, user_id, experiment_key, title, readings, slope, r_squared, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("formulas")
        .select("id", { count: "exact", head: true })
        .is("is_custom", false),
    ]);

  for (const result of [formulasResult, customResult, bookmarksResult, labRunsResult, totalResult]) {
    if (result.error) {
      console.error("[formulax] getUserData", result.error);
    }
  }

  const baselineFormulas = (formulasResult.data as FormulaRow[] | null) ?? [];
  const customFormulas = (customResult.data as FormulaRow[] | null) ?? [];

  return {
    baselineFormulas,
    customFormulas,
    allFormulas: [...baselineFormulas, ...customFormulas],
    bookmarks: ((bookmarksResult.data as { formula_id: string }[] | null) ?? []).map(
      (bookmark) => bookmark.formula_id,
    ),
    labRuns: (labRunsResult.data as LabRunRow[] | null) ?? [],
    totalFormulas: baselineFormulas.length + customFormulas.length,
  };
}

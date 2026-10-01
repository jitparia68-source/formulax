-- FormulaX - Supabase Postgres schema (Postgres 17).
-- Idempotent: safe to run repeatedly. Apply with psql as the `postgres` role.
--
-- DESIGN NOTE - formula_id vs slug
-- The PRD pairs `formulas.id UUID` with `saved_bookmarks.formula_id TEXT`, which cannot
-- form a foreign key and leaves bookmarks dangling when a formula is deleted.
-- Resolution: `formulas.slug TEXT` is a stable, human-readable, client-referenceable key
-- (e.g. `ohms-law`), and `saved_bookmarks.formula_id` is a real FK to it with
-- ON DELETE CASCADE. `formulas.id` stays a UUID surrogate key for internal joins.
-- Baseline rows are seeded with fixed slugs so the frontend can hardcode them; custom
-- formulas get a slug from the `formulas_set_slug` trigger (title slug + uuid prefix),
-- so a client can always read back the slug it must bookmark with.
--
-- DESIGN NOTE - solver metadata
-- The PRD has no place for solver variable definitions. Rather than a second table, the
-- solver payload lives in `formulas.solver_meta JSONB` (nullable), seeded for the five
-- interactive formulas. Functions cannot be stored in JSON, so each `solve` entry is a
-- mathjs-parseable expression string over the *other* variables, not a JS closure:
--   { "vars": { "V": "Voltage (V)", ... }, "solve": { "V": "I * R", ... } }
--
-- SECURITY - Row Level Security is enabled on every table with no policies, i.e. deny-all
-- for `anon` / `authenticated`. Grants are revoked from those roles as well. The app only
-- ever reaches the database through the service-role client in `lib/supabase.ts`, which
-- bypasses RLS. Without this, PostgREST would expose `users.password_hash` to the anon key.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  email         TEXT NOT NULL CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1),
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_key UNIQUE (email)
);

-- ---------------------------------------------------------------------------
-- formulas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.formulas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
  slug          TEXT UNIQUE,
  title         TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  category      TEXT NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 60),
  latex         TEXT NOT NULL CHECK (length(latex) BETWEEN 1 AND 4000),
  description   TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  reference_url TEXT CHECK (reference_url IS NULL OR length(reference_url) <= 2048),
  solver_meta   JSONB,
  is_custom     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A formula is either global baseline content or owned by exactly one user.
  CONSTRAINT formulas_ownership_ck CHECK (
    (is_custom AND user_id IS NOT NULL) OR (NOT is_custom AND user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS formulas_user_id_idx ON public.formulas (user_id);
CREATE INDEX IF NOT EXISTS formulas_category_idx ON public.formulas (category);
CREATE INDEX IF NOT EXISTS formulas_solver_meta_idx ON public.formulas (slug)
  WHERE solver_meta IS NOT NULL;

-- Derive a slug when the caller does not supply one. The uuid prefix keeps it unique
-- even for two users saving identically-titled formulas.
CREATE OR REPLACE FUNCTION public.formulas_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base TEXT;
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    base := regexp_replace(lower(btrim(NEW.title)), '[^a-z0-9]+', '-', 'g');
    base := btrim(base, '-');
    IF base = '' THEN
      base := 'formula';
    END IF;
    NEW.slug := base || '-' || substr(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS formulas_set_slug_trg ON public.formulas;
CREATE TRIGGER formulas_set_slug_trg
  BEFORE INSERT OR UPDATE OF title, slug ON public.formulas
  FOR EACH ROW EXECUTE FUNCTION public.formulas_set_slug();

-- ---------------------------------------------------------------------------
-- saved_bookmarks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  formula_id TEXT NOT NULL REFERENCES public.formulas(slug) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_bookmarks_user_formula_key UNIQUE (user_id, formula_id)
);

CREATE INDEX IF NOT EXISTS saved_bookmarks_user_id_idx ON public.saved_bookmarks (user_id);

-- ---------------------------------------------------------------------------
-- lab_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  experiment_key TEXT NOT NULL CHECK (length(btrim(experiment_key)) BETWEEN 1 AND 80),
  title          TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  readings       JSONB NOT NULL,
  slope          DOUBLE PRECISION NOT NULL CHECK (slope = slope),
  r_squared      DOUBLE PRECISION NOT NULL CHECK (r_squared = r_squared),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lab_runs_user_created_idx
  ON public.lab_runs (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Baseline content
-- ---------------------------------------------------------------------------
INSERT INTO public.formulas
  (slug, user_id, title, category, latex, description, is_custom, solver_meta)
VALUES
  ('power-rule', NULL, 'Power Rule', 'Calculus',
   '\frac{d}{dx}(x^n)=nx^{n-1}',
   'Derivative of a power function.', FALSE, NULL),
  ('product-rule', NULL, 'Product Rule', 'Calculus',
   '\frac{d}{dx}(uv)=u''v+uv''',
   'Derivative of a product of two functions.', FALSE, NULL),
  ('chain-rule', NULL, 'Chain Rule', 'Calculus',
   '\frac{d}{dx}f(g(x))=f''(g(x))g''(x)',
   'Derivative of a composite function.', FALSE, NULL),
  ('quadratic-formula', NULL, 'Quadratic Formula', 'Calculus',
   'x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}',
   'Solutions of a quadratic equation.', FALSE, NULL),
  ('matrix-determinant', NULL, 'Matrix Determinant', 'Linear Algebra',
   '\begin{vmatrix}a&b\\c&d\end{vmatrix}=ad-bc',
   'Determinant of a 2 x 2 matrix.', FALSE, NULL),
  ('ohms-law', NULL, 'Ohm''s Law', 'Electrical',
   'V=IR',
   'Relationship between voltage, current and resistance.', FALSE,
   '{"vars":{"V":"Voltage (V)","I":"Current (A)","R":"Resistance (ohm)"},"solve":{"V":"I * R","I":"V / R","R":"V / I"}}'::jsonb),
  ('electrical-power', NULL, 'Electrical Power', 'Electrical',
   'P=VI=I^2R=\frac{V^2}{R}',
   'Electrical power formula.', FALSE,
   '{"vars":{"P":"Power (W)","V":"Voltage (V)","I":"Current (A)"},"solve":{"P":"V * I","V":"P / I","I":"P / V"}}'::jsonb),
  ('resonant-frequency', NULL, 'Resonant Frequency', 'Electrical',
   'f=\frac{1}{2\pi\sqrt{LC}}',
   'Frequency of an LC circuit.', FALSE,
   '{"vars":{"f":"Frequency (Hz)","L":"Inductance (H)","C":"Capacitance (F)"},"solve":{"f":"1 / (2 * pi * sqrt(L * C))","L":"1 / ((2 * pi * f)^2 * C)","C":"1 / ((2 * pi * f)^2 * L)"}}'::jsonb),
  ('newtons-second-law', NULL, 'Newton''s Second Law', 'Physics',
   'F=ma',
   'Force equals mass times acceleration.', FALSE,
   '{"vars":{"F":"Force (N)","m":"Mass (kg)","a":"Acceleration (m/s^2)"},"solve":{"F":"m * a","m":"F / a","a":"F / m"}}'::jsonb),
  ('kinetic-energy', NULL, 'Kinetic Energy', 'Physics',
   'KE=\frac{1}{2}mv^2',
   'Energy due to motion.', FALSE,
   '{"vars":{"KE":"Kinetic energy (J)","m":"Mass (kg)","v":"Velocity (m/s)"},"solve":{"KE":"0.5 * m * v^2","m":"2 * KE / v^2","v":"sqrt(2 * KE / m)"}}'::jsonb),
  ('potential-energy', NULL, 'Potential Energy', 'Physics',
   'PE=mgh',
   'Gravitational potential energy.', FALSE, NULL),
  ('momentum', NULL, 'Momentum', 'Physics',
   'p=mv',
   'Linear momentum.', FALSE, NULL),
  ('ideal-gas-law', NULL, 'Ideal Gas Law', 'Thermodynamics',
   'PV=nRT',
   'Pressure-volume-temperature relationship.', FALSE, NULL),
  ('heat-equation', NULL, 'Heat Equation', 'Thermodynamics',
   'Q=mc\Delta T',
   'Heat transferred due to temperature change.', FALSE, NULL),
  ('efficiency', NULL, 'Efficiency', 'Thermodynamics',
   '\eta=\frac{W_{out}}{W_{in}}\times100',
   'Ratio of useful output to input.', FALSE, NULL)
ON CONFLICT (slug) DO UPDATE SET
  title       = EXCLUDED.title,
  category    = EXCLUDED.category,
  latex       = EXCLUDED.latex,
  description = EXCLUDED.description,
  solver_meta = EXCLUDED.solver_meta;

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-all for anon/authenticated, service role bypasses.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.formulas FROM anon, authenticated;
REVOKE ALL ON public.saved_bookmarks FROM anon, authenticated;
REVOKE ALL ON public.lab_runs FROM anon, authenticated;
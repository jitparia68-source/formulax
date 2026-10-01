"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MathFormula } from "@/components/math-formula";
import { FORMULA_CATEGORIES, type FormulaRow } from "@/types/database";

type Props = {
  formulas: FormulaRow[];
};

type Progress = {
  correct: number;
  attempts: number;
  streak: number;
  bestStreak: number;
  /** Correct-answer count per category, used to surface weak topics. */
  byCategory: Record<string, { correct: number; total: number }>;
};

const EMPTY_PROGRESS: Progress = {
  correct: 0,
  attempts: 0,
  streak: 0,
  bestStreak: 0,
  byCategory: {},
};

const STORAGE_KEY = "formulax.practice.v1";

type Question = {
  formula: FormulaRow;
  options: FormulaRow[];
  answerIndex: number;
};

function loadProgress(): Progress {
  if (typeof window === "undefined") {
    return EMPTY_PROGRESS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_PROGRESS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return EMPTY_PROGRESS;
    }
    const candidate = parsed as Partial<Progress>;
    return {
      correct: Number(candidate.correct ?? 0),
      attempts: Number(candidate.attempts ?? 0),
      streak: Number(candidate.streak ?? 0),
      bestStreak: Number(candidate.bestStreak ?? 0),
      byCategory:
        typeof candidate.byCategory === "object" && candidate.byCategory !== null
          ? candidate.byCategory
          : {},
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

/**
 * Builds a multiple-choice question: the prompt is a formula's description, and the
 * options are that formula's LaTeX alongside three other formulas from the vault. The
 * prototype showed the correct answer as its only button and scored every click as
 * correct, so this generates genuine distractors.
 */
function buildQuestion(
  pool: FormulaRow[],
  exclude: Set<string>,
): Question | null {
  const candidates = pool.filter((formula) => !exclude.has(formula.slug));
  const source = candidates.length > 0 ? candidates : pool;
  if (source.length < 4) {
    return null;
  }

  const answer = source[Math.floor(Math.random() * source.length)]!;
  const distractors = source.filter((formula) => formula.slug !== answer.slug);
  const picked: FormulaRow[] = [];
  const usedIndices = new Set<number>();

  while (picked.length < 3) {
    const index = Math.floor(Math.random() * distractors.length);
    if (usedIndices.has(index)) {
      break;
    }
    usedIndices.add(index);
    picked.push(distractors[index]!);
  }
  if (picked.length < 3) {
    return null;
  }

  const options = [...picked, answer];
  // Fisher-Yates so the answer is not always last.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }

  return {
    formula: answer,
    options,
    answerIndex: options.findIndex((option) => option.slug === answer.slug),
  };
}

export function PracticeQuiz({ formulas }: Props) {
  const pool = useMemo(
    () => formulas.filter((formula) => formula.is_custom || formula.latex.length > 0),
    [formulas],
  );
  // Progress lives only in this browser - there is no practice table in the schema - so it
  // is read lazily on mount. The initialiser returns the empty state during SSR and on
  // the hydration pass, which keeps the server and client markup identical.
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [question, setQuestion] = useState<Question | null>(null);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadProgress();
    // Deferred to a task so the state update lands after hydration completes rather
    // than during the same commit, which would risk a markup mismatch.
    const id = window.setTimeout(() => {
      setProgress(stored);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const save = useCallback((next: Progress) => {
    setProgress(next);
    setHydrated(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A full or disabled localStorage must not break the quiz.
    }
  }, []);

  const nextQuestion = useCallback(() => {
    const built = buildQuestion(pool, asked);
    if (!built) {
      setQuestion(null);
      return;
    }
    setAsked((current) => {
      const next = new Set(current);
      next.add(built.formula.slug);
      return next;
    });
    setQuestion(built);
    setAnswerIndex(null);
    setShowHint(false);
    setRound((value) => value + 1);
  }, [asked, pool]);

  function startRound() {
    setAsked(new Set());
    setRound(0);
    const built = buildQuestion(pool, new Set());
    if (built) {
      setAsked(new Set([built.formula.slug]));
      setQuestion(built);
      setAnswerIndex(null);
      setShowHint(false);
      setRound(1);
    } else {
      setQuestion(null);
    }
  }

  function submit(index: number) {
    if (!question || answerIndex !== null) {
      return;
    }
    setAnswerIndex(index);

    const correct = index === question.answerIndex;
    const category = question.formula.category;
    const existing = progress.byCategory[category] ?? { correct: 0, total: 0 };
    const streak = correct ? progress.streak + 1 : 0;

    save({
      correct: progress.correct + (correct ? 1 : 0),
      attempts: progress.attempts + 1,
      streak,
      bestStreak: Math.max(progress.bestStreak, streak),
      byCategory: {
        ...progress.byCategory,
        [category]: {
          correct: existing.correct + (correct ? 1 : 0),
          total: existing.total + 1,
        },
      },
    });
  }

  const accuracy =
    progress.attempts === 0
      ? 0
      : Math.round((progress.correct / progress.attempts) * 100);

  const weakTopics = FORMULA_CATEGORIES.flatMap((category) => {
    const record = progress.byCategory[category];
    if (!record || record.total < 2) {
      return [];
    }
    const rate = record.correct / record.total;
    return rate < 0.7 ? [{ category, rate, total: record.total }] : [];
  }).sort((a, b) => a.rate - b.rate);

  if (pool.length < 4) {
    return (
      <p className="fx-card px-6 py-10 text-center text-sm text-ink-muted">
        At least four formulas are needed to build a quiz. Add more to your vault first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="fx-card p-5" aria-labelledby="practice-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="practice-heading" className="text-sm font-semibold">
              Formula recall
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Read the description and pick the equation that matches it.
            </p>
          </div>
          {hydrated ? (
            <dl className="flex gap-5 text-right">
              {[
                { label: "Correct", value: progress.correct },
                { label: "Attempts", value: progress.attempts },
                { label: "Accuracy", value: `${accuracy}%` },
                { label: "Best streak", value: progress.bestStreak },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-[0.6875rem] tracking-wide text-ink-muted uppercase">
                    {stat.label}
                  </dt>
                  <dd className="font-mono text-lg font-semibold text-accent">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={startRound} className="fx-btn fx-btn-primary">
            {round > 0 ? "Restart round" : "Start round"}
          </button>
          {question ? (
            <>
              <button
                type="button"
                onClick={() => setShowHint((value) => !value)}
                aria-expanded={showHint}
                className="fx-btn fx-btn-secondary"
              >
                {showHint ? "Hide hint" : "Show hint"}
              </button>
              <button
                type="button"
                onClick={nextQuestion}
                className="fx-btn fx-btn-ghost"
              >
                Next question
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => save(EMPTY_PROGRESS)}
            className="fx-btn fx-btn-ghost ml-auto"
          >
            Reset stats
          </button>
        </div>

        <div aria-live="polite" className="mt-5">
          {!question ? (
            <p className="fx-card px-4 py-8 text-center text-sm text-ink-muted">
              Start a round to be shown a description and four candidate equations.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-xs tracking-wide text-ink-faint uppercase">
                Question {round}
                {progress.streak > 0 ? ` - ${progress.streak} in a row` : ""}
              </p>

              <div className="fx-card px-4 py-4">
                <p className="text-sm text-ink-muted">
                  Which equation is described as
                  {question.formula.category ? ` a ${question.formula.category.toLowerCase()} formula` : ""}{" "}
                  &ldquo;{question.formula.description}&rdquo;?
                </p>
                {showHint ? (
                  <p className="mt-2 text-sm text-accent">
                    Hint: it is titled &ldquo;{question.formula.title}&rdquo;.
                  </p>
                ) : null}
              </div>

              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {question.options.map((option, index) => {
                  const isAnswer = index === question.answerIndex;
                  const isChosen = index === answerIndex;
                  const stateClass =
                    answerIndex === null
                      ? ""
                      : isAnswer
                        ? "border-success/60 bg-success/10"
                        : isChosen
                          ? "border-danger/60 bg-danger/10"
                          : "opacity-50";
                  return (
                    <li key={option.slug}>
                      <button
                        type="button"
                        onClick={() => submit(index)}
                        disabled={answerIndex !== null}
                        className={`fx-card w-full px-4 py-3 text-left transition ${stateClass}`}
                      >
                        <MathFormula latex={option.latex} display={false} />
                        <span className="mt-1 block text-xs text-ink-faint">
                          {option.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {answerIndex !== null ? (
                <p
                  className={
                    answerIndex === question.answerIndex
                      ? "rounded-input border border-success/40 bg-success/12 px-4 py-3 text-sm text-success"
                      : "fx-error"
                  }
                >
                  {answerIndex === question.answerIndex
                    ? `Correct - ${question.formula.title}.`
                    : `That was ${question.formula.title}.`}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="fx-card p-5" aria-labelledby="weak-heading">
        <h2 id="weak-heading" className="text-sm font-semibold">
          Where to revise
        </h2>
        {weakTopics.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Nothing flagged yet. Categories drop in here once you have answered at least
            two questions with an accuracy under 70%.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              These categories are below 70% accuracy. Review them, then try again.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {weakTopics.map((topic) => (
                <li
                  key={topic.category}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <a
                    href={`/formulas?category=${encodeURIComponent(topic.category)}`}
                    className="text-sm text-accent hover:text-accent-hover"
                  >
                    {topic.category} &rarr;
                  </a>
                  <span className="font-mono text-xs text-ink-muted">
                    {Math.round(topic.rate * 100)}% over {topic.total} questions
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

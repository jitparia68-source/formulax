"use client";

import katex from "katex";
import { useMemo } from "react";

type Props = {
  latex: string;
  display?: boolean;
  className?: string;
};

/**
 * KaTeX is imported into a client component so its sizeable parser never enters the
 * server bundle. `throwOnError: false` keeps a malformed formula in user content from
 * taking down the page - KaTeX renders the source in red instead.
 */
export function MathFormula({ latex, display = true, className }: Props) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        output: "html",
        trust: false,
      });
    } catch {
      return null;
    }
  }, [latex, display]);

  if (html === null) {
    return (
      <code className="font-mono text-xs text-ink-faint break-words">{latex}</code>
    );
  }

  return (
    <div
      className={`fx-math ${className ?? ""}`}
      // KaTeX output is generated from a sanitised LaTeX subset by KaTeX itself; the
      // surrounding user text is never interpolated into this string.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * LaTeX -> readable plain text.
 *
 * Pure function: no React, no DOM, no I/O. It backs the "copy as text" affordance on a
 * formula card, so a student pasting into Word, slides or email gets `R = V / I` rather
 * than a line of backslashes.
 *
 * Deliberately best-effort and ASCII-only. Commands outside the tables below are dropped
 * rather than printed, so an exotic macro degrades to a slightly wrong string instead of
 * leaking `\unknownmacro` into a student's document. When the conversion yields nothing
 * useful, the original LaTeX is returned, so this never destroys a value or throws.
 */

/** Commands mapped to a readable replacement. */
const SYMBOLS: Readonly<Record<string, string>> = {
  times: "* ",
  div: "/ ",
  cdot: "*",
  ast: "*",
  pm: "+/- ",
  mp: "+/- ",
  leq: "<= ",
  le: "<= ",
  geq: ">= ",
  ge: ">= ",
  neq: "!= ",
  ne: "!= ",
  approx: "~=",
  equiv: "==",
  propto: "prop to ",
  infty: "infinity ",
  partial: "d ",
  delta: "delta ",
  Delta: "Delta ",
  theta: "theta ",
  alpha: "alpha ",
  beta: "beta ",
  gamma: "gamma ",
  lambda: "lambda ",
  mu: "mu ",
  nu: "nu ",
  pi: "pi ",
  sigma: "sigma ",
  Sigma: "Sigma ",
  rho: "rho ",
  tau: "tau ",
  phi: "phi ",
  Phi: "Phi ",
  omega: "omega ",
  eta: "eta ",
  epsilon: "epsilon ",
  int: "integral ",
  in: "in ",
  sum: "sum ",
  prod: "product ",
  sin: "sin ",
  cos: "cos ",
  tan: "tan ",
  cot: "cot ",
  sec: "sec ",
  csc: "csc ",
  arcsin: "arcsin ",
  arccos: "arccos ",
  arctan: "arctan ",
  sinh: "sinh ",
  cosh: "cosh ",
  tanh: "tanh ",
  log: "log ",
  ln: "ln ",
  exp: "exp ",
  det: "det ",
  dim: "dim ",
  lim: "lim ",
  max: "max ",
  min: "min ",
  deg: "deg ",
  ldots: "...",
  cdots: "...",
  therefore: "therefore ",
  because: "because ",
  forall: "for all ",
  exists: "exists ",
  lvert: "|",
  rvert: "|",
  lVert: "||",
  rVert: "||",
  langle: "<",
  rangle: ">",
  lfloor: "floor( ",
  rfloor: ")",
  lceil: "ceil( ",
  rceil: ")",
};

/** How many `{...}` arguments a command consumes, for the passthrough commands. */
const ARG_COUNTS: Readonly<Record<string, number>> = {
  sqrt: 1,
  dfrac: 2,
  tfrac: 2,
  binom: 2,
  choose: 2,
  text: 1,
  textrm: 1,
  mathrm: 1,
  mathbf: 1,
  operatorname: 1,
  hat: 1,
  bar: 1,
  vec: 1,
  dot: 1,
  overline: 1,
  underline: 1,
};

/** Environments that are pure layout and can be dropped wholesale. */
const LAYOUT_ENVIRONMENTS = new Set([
  "align",
  "align*",
  "aligned",
  "gather",
  "gather*",
  "gathered",
  "equation",
  "equation*",
  "eqnarray",
  "eqnarray*",
  "split",
  "cases",
  "displaymath",
  "smallmatrix",
  "array",
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
]);

/** Superscript bodies that have a short ASCII form. */
const SUPERSCRIPT_SHORT: Readonly<Record<string, string>> = {
  "0": "^0",
  "1": "^1",
  "2": "^2",
  "3": "^3",
  "4": "^4",
  "5": "^5",
  "6": "^6",
  "7": "^7",
  "8": "^8",
  "9": "^9",
  "+": "^(+)",
  "-": "^(-)",
  n: "^n",
  i: "^i",
  o: "^o",
};

/** Commands consumed by the parser but contributing no output. */
const DROPPED_COMMANDS = new Set([
  "left",
  "right",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "bigl",
  "bigr",
  "displaystyle",
  "limits",
  "nolimits",
]);

const SUPERSCRIPT_WORDS: Readonly<Record<string, string>> = {
  circ: "^(o)",
  prime: "'",
};

/** Escaped punctuation. `\\` is the array row separator and becomes a space. */
const ESCAPED_CHARS: Readonly<Record<string, string>> = {
  "%": "%",
  "&": " and ",
  "#": "#",
  $: "$",
  _: "_",
  "{": "{",
  "}": "}",
};

function readCommandEnd(source: string, start: number): number {
  let index = start + 1;
  while (index < source.length && /[a-zA-Z]/.test(source[index] ?? "")) {
    index += 1;
  }
  // `\ ` and friends: a single non-letter after the backslash is the whole command.
  return index === start + 1 ? start + 2 : index;
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  // Unbalanced input: take the remainder rather than throwing.
  return source.length;
}

function readArgument(source: string, start: number): { text: string; next: number } {
  let index = start;
  while (index < source.length && /\s/.test(source[index] ?? "")) {
    index += 1;
  }
  if (index >= source.length) {
    return { text: "", next: index };
  }
  if (source[index] === "{") {
    const end = findMatchingBrace(source, index);
    return { text: convert(source.slice(index + 1, end)), next: end + 1 };
  }
  if (source[index] === "\\") {
    const end = readCommandEnd(source, index);
    return { text: convert(source.slice(index, end)), next: end };
  }
  return { text: source[index] ?? "", next: index + 1 };
}

function collapse(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([=+\-*/<>^,.;:)])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .replace(/\s+([(])/g, "$1")
    .replace(/\s+and\s+and\s+/g, " and ")
    .trim();
}

function convertSuperscript(body: string): string {
  const inner = collapse(body);
  if (inner.length === 0) {
    return "^";
  }
  if (inner.length === 1) {
    const mapped = SUPERSCRIPT_SHORT[inner];
    if (mapped !== undefined) {
      return mapped;
    }
  }
  if (inner === "(") {
    return "^(...)";
  }
  if (inner === "circ" || inner === "degree") {
    return "^(o)";
  }
  if (inner === "prime" || inner === "'") {
    return "'";
  }
  const word = SUPERSCRIPT_WORDS[inner];
  return word ?? `^(${inner})`;
}

function convertSubscript(body: string): string {
  const inner = collapse(body);
  if (inner.length === 0) {
    return "_";
  }
  if (inner.length === 1) {
    return `_${inner}`;
  }
  return `(${inner})`;
}

function convert(source: string): string {
  let output = "";
  let index = 0;

  while (index < source.length) {
    const char = source[index] ?? "";

    if (char === "^" || char === "_") {
      const argument = readArgument(source, index + 1);
      index = argument.next;
      output +=
        char === "^"
          ? convertSuperscript(argument.text)
          : convertSubscript(argument.text);
      continue;
    }

    if (char !== "\\") {
      if (char === "{") {
        const end = findMatchingBrace(source, index);
        output += convert(source.slice(index + 1, end));
        index = end + 1;
        continue;
      }
      output += char;
      index += 1;
      continue;
    }

    // `\\` is the row separator inside arrays and matrices, not a command.
    if (source[index + 1] === "\\") {
      output += " ";
      index += 2;
      continue;
    }

    // Escaped punctuation.
    if (source[index + 1] !== undefined && !/[a-zA-Z]/.test(source[index + 1] ?? "")) {
      const escaped = source[index + 1] ?? "";
      output += ESCAPED_CHARS[escaped] ?? escaped;
      index += 2;
      continue;
    }

    const commandEnd = readCommandEnd(source, index);
    const name = source.slice(index + 1, commandEnd);
    index = commandEnd;

    if (name === "begin" || name === "end") {
      const argument = readArgument(source, index);
      index = argument.next;
      if (!LAYOUT_ENVIRONMENTS.has(argument.text.trim())) {
        // Unknown environment: emit nothing rather than the environment name.
        output += " ";
      }
      continue;
    }

    if (name === "frac" || name === "dfrac" || name === "tfrac") {
      const numerator = readArgument(source, index);
      const denominator = readArgument(source, numerator.next);
      index = denominator.next;
      output += ` (${collapse(numerator.text)}) / (${collapse(denominator.text)}) `;
      continue;
    }

    if (name === "sqrt") {
      let next = index;
      // Optional root index: \sqrt[3]{x}
      if (source[next] === "[") {
        const close = source.indexOf("]", next);
        if (close !== -1) {
          next = close + 1;
        }
      }
      const radicand = readArgument(source, next);
      index = radicand.next;
      output += `sqrt(${collapse(radicand.text)})`;
      continue;
    }

    if (name === "binom" || name === "choose") {
      const top = readArgument(source, index);
      const bottom = readArgument(source, top.next);
      index = bottom.next;
      output += `C(${collapse(top.text)}, ${collapse(bottom.text)})`;
      continue;
    }

    if (name === "over" || name === "atop") {
      // Legacy inline fraction; the two sides are already separated in the output.
      continue;
    }

    if (ARG_COUNTS[name] !== undefined) {
      const argument = readArgument(source, index);
      index = argument.next;
      output += argument.text;
      continue;
    }

    if (DROPPED_COMMANDS.has(name)) {
      continue;
    }

    const symbol = SYMBOLS[name];
    output += symbol ?? "";
  }

  return collapse(output);
}

/**
 * Convert a LaTeX fragment into plain, readable ASCII text.
 *
 * Never throws. Falls back to the input string when the input is empty or the conversion
 * produces nothing, so the caller always has something copyable.
 */
/**
 * Spacing pass applied to the converted string.
 *
 * The converter is intentionally paren-happy: `\frac{a}{b}` becomes `(a)/(b)` because
 * that is unambiguous, and `\frac{a}{b} = c` becomes `(a)/(b)=c` because the converter
 * only knows which glyph it just emitted, not whether an operator is next. Normalising
 * the space around relational and arithmetic operators is what turns the former into
 * readable output without the converter needing lookahead.
 *
 * Only `=` is spaced on both sides. `+` and `-` are frequently unary (`x^-1`, `b-4ac`)
 * and a blind space either way corrupts them, so they are left tight.
 */
function spaceOperators(text: string): string {
  return text
    .replace(/[ \t]*=[ \t]*/g, " = ")
    .replace(/\s*<\s*/g, " < ")
    .replace(/\s*>\s*/g, " > ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Guards the one promise this function makes: the result is plain text. A stray brace or
 * backslash surviving into the output would be pasted into Word and look like a defect,
 * which is worse than the unconverted original. So if any LaTeX structural character is
 * still present, the original is returned instead and the caller can decide.
 *
 * `^` and `_` are deliberately NOT in this set. The converter emits them as literal
 * ASCII for exponents and subscripts (`V^2`, `x^(n-1)`, `P_out`), and that is the
 * readable form we actually want. A `$` is also excluded because it is rare in the
 * stored expressions and is stripped upstream.
 */
const RESIDUAL_LATEX = /[\\{}]/;

export function latexToText(latex: string): string {
  if (typeof latex !== "string" || latex.trim().length === 0) {
    return latex;
  }
  try {
    const text = spaceOperators(convert(latex));
    if (text.length === 0 || RESIDUAL_LATEX.test(text)) {
      return latex;
    }
    return text;
  } catch {
    return latex;
  }
}
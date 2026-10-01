"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  className = "fx-btn fx-btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`${className} animate-spin`}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-danger-bright">
      {children}
    </p>
  );
}

/**
 * Backdrop for the auth pages. Durations are long and the delays are offset so the motion
 * never pulses in unison, and the delays are negative so nothing is static on first paint.
 * `left`/`top` are percentages so the composition holds at any viewport size.
 */
const AUTH_DECOR = [
  { text: "E = mc^2", top: "9%", left: "6%", motion: "drift", duration: 26, delay: -4 },
  { text: "V = IR", top: "72%", left: "9%", motion: "sway", duration: 31, delay: -12 },
  { text: "f(x) = x^2", top: "20%", left: "76%", motion: "sway", duration: 29, delay: -7 },
  { text: "a^2 + b^2 = c^2", top: "82%", left: "64%", motion: "drift", duration: 34, delay: -18 },
  { text: "dE = F dx", top: "48%", left: "2%", motion: "drift", duration: 38, delay: -22 },
  { text: "P = IV", top: "42%", left: "88%", motion: "sway", duration: 33, delay: -15 },
] as const;

const AUTH_SHAPES = [
  { id: "ring-large", kind: "circle", top: "12%", left: "58%", size: 250, duration: 40, delay: -10, motion: "drift", rotate: "rotate(0deg)", radius: "50%" },
  { id: "square-tilted", kind: "square", top: "66%", left: "80%", size: 165, duration: 36, delay: -20, motion: "sway", rotate: "rotate(18deg)", radius: "22px" },
  { id: "ring-small", kind: "circle", top: "74%", left: "12%", size: 120, duration: 44, delay: -26, motion: "sway", rotate: "rotate(0deg)", radius: "50%" },
] as const;

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="fx-auth flex min-h-screen items-center justify-center px-4 py-10">
      {/*
        Decorative only. Fixed-position rather than absolutely positioned so these never
        contribute to document height, which would otherwise let a tall viewport scroll a
        centred form off-screen. Hidden from assistive tech and from pointer events.
      */}
      <div className="fx-auth-decor" aria-hidden="true">
        {AUTH_DECOR.map((item) => (
          <span
            key={item.text}
            className="fx-auth-decor-item"
            style={{
              top: item.top,
              left: item.left,
              animation: `${item.motion} ${item.duration}s ease-in-out ${item.delay}s infinite`,
            }}
          >
            {item.text}
          </span>
        ))}
        {AUTH_SHAPES.map((shape) => (
          <span
            key={shape.id}
            className="fx-auth-shape"
            style={{
              top: shape.top,
              left: shape.left,
              width: shape.size,
              height: shape.size,
              borderRadius: shape.kind === "circle" ? "50%" : shape.radius,
              transform: shape.rotate,
              animation: `${shape.motion} ${shape.duration}s ease-in-out ${shape.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span
            aria-hidden="true"
            className="fx-brand-mark size-9 rounded-input font-mono font-bold"
          >
            &int;
          </span>
          <span className="text-lg font-semibold tracking-tight text-rail-ink">FormulaX</span>
        </Link>

        <div className="fx-auth-card p-6">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </div>
  );
}

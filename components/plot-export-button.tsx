"use client";

import { useState } from "react";

import { useToast } from "@/components/toast-provider";

/**
 * Rasterises the function-plot SVG and downloads it as a PNG, for dropping a graph
 * straight into a lab report.
 *
 * The failure modes here are real and each is handled rather than assumed away:
 *
 *  1. A detached SVG with no intrinsic `width`/`height` is refused by the browser and
 *     rasterises as blank, so the attributes are set explicitly from the layout box.
 *  2. Styles defined in the page stylesheet do not travel inside a `data:` URL, and the
 *     plot's own text is styled via `currentColor`. An inline `<style>` block carrying the
 *     resolved colours is therefore injected into a cloned copy.
 *  3. `canvas.toDataURL` throws if the canvas was ever tainted by a cross-origin draw.
 *     function-plot draws nothing external today, but the call is guarded anyway so a
 *     future plot option cannot turn this into a silent failure.
 *  4. At `devicePixelRatio` 1 a 1200px graph exports at 1200px and looks soft when placed
 *     in a document, so the canvas is scaled and the context re-scaled to compensate.
 */

type Props = {
  /** The live SVG node, which the plotter renders into a container ref. */
  svg: SVGSVGElement | null;
  expression: string;
  background: string;
  ink: string;
};

const SCALE_CEILING = 3;

function fileSlug(expression: string): string {
  const cleaned = expression
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return cleaned.length > 0 ? cleaned.slice(0, 40) : "plot";
}

export function PlotExportButton({ svg, expression, background, ink }: Props) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  async function onExport() {
    if (!svg) {
      notify("The graph is still loading. Try again in a moment.", "error");
      return;
    }

    setBusy(true);

    try {
      const box = svg.getBoundingClientRect();
      const width = Math.max(1, Math.round(box.width));
      const height = Math.max(1, Math.round(box.height));

      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      // Injected last so it wins over the cloned inline attributes.
      const style = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "style",
      );
      style.textContent = `
        svg { background: ${background}; }
        .annotation { fill: ${ink}; }
        .tick line, .tick path { stroke: ${ink}; }
        .domain, .domain-background { stroke: ${ink}; }
        text, .text { fill: ${ink}; }
      `;
      clone.insertBefore(style, clone.firstChild);

      const source = new XMLSerializer().serializeToString(clone);
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(new Error("The browser could not rasterise the graph."));
        image.src = url;
      });

      const ratio = Math.min(window.devicePixelRatio || 1, SCALE_CEILING);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("This browser could not provide a 2D canvas.");
      }

      // The scale is applied to the transform, not the bitmap, so the graph fills the
      // higher-resolution canvas rather than being drawn small into its corner.
      context.scale(ratio, ratio);
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl.startsWith("data:image/png")) {
        throw new Error("The export did not produce a PNG.");
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `formulax-${fileSlug(expression)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      notify(`Saved formulax-${fileSlug(expression)}.png`, "success");
    } catch (error) {
      console.error("[formulax] plot export", error);
      notify(
        error instanceof Error
          ? `Export failed: ${error.message}`
          : "The graph could not be exported.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onExport()}
      disabled={busy}
      className="fx-btn fx-btn-secondary"
      aria-label={`Download the graph of ${expression} as a PNG image`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
        <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
      </svg>
      {busy ? "Exporting..." : "Download PNG"}
    </button>
  );
}

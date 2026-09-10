"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { InductionTrainingSlide } from "@macro/shared/types";

const DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 540;

/**
 * Read-only Fabric.js render of a training slide — reproduces exactly what
 * the admin built in the PowerPoint-style editor (same canvas JSON, same
 * fonts/positions/images), just non-interactive and responsively scaled to
 * fit the employee's screen.
 */
export function SlidePresentationCanvas({ slide }: { slide: InductionTrainingSlide }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!slide.canvasJson) return;
    let cancelled = false;

    lifecycleRef.current = lifecycleRef.current.then(async () => {
      if (cancelled || !canvasElRef.current) return;
      try {
        const { StaticCanvas } = await import("fabric");
        if (cancelled || !canvasElRef.current) return;
        const canvas = new StaticCanvas(canvasElRef.current, { width: DESIGN_WIDTH, height: DESIGN_HEIGHT });
        fabricRef.current = canvas;
        await canvas.loadFromJSON(slide.canvasJson!);
        if (cancelled) return;
        resize();
        canvas.renderAll();
      } catch {
        if (!cancelled) setLoadError(true);
      }
    });

    function resize() {
      const canvas = fabricRef.current;
      const container = containerRef.current;
      if (!canvas || !container || container.clientWidth === 0) return;
      const scale = container.clientWidth / DESIGN_WIDTH;
      canvas.setDimensions({ width: DESIGN_WIDTH * scale, height: DESIGN_HEIGHT * scale });
      canvas.setZoom(scale);
      canvas.renderAll();
    }

    const ro = new ResizeObserver(() => resize());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      lifecycleRef.current = lifecycleRef.current.then(async () => {
        if (fabricRef.current) {
          await fabricRef.current.dispose();
          fabricRef.current = null;
        }
      });
    };
  }, [slide.id, slide.canvasJson]);

  if (!slide.canvasJson || loadError) {
    // Fallback for a slide created before the canvas editor existed.
    return (
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="mb-3 text-lg font-extrabold text-text-dark">{slide.title}</h2>
        {slide.imageUrl && <Image src={slide.imageUrl} alt="" width={480} height={270} className="mb-3 w-full rounded-lg object-cover" unoptimized />}
        {slide.content && <p className="whitespace-pre-line text-sm leading-relaxed text-text-dark">{slide.content}</p>}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div ref={containerRef} className="w-full" style={{ aspectRatio: `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}` }}>
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}

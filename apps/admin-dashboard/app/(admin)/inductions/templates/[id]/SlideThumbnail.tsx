"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef } from "react";
import type { InductionTrainingSlide } from "@macro/shared/types";

const DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 540;
const THUMB_WIDTH = 176;
const THUMB_HEIGHT = Math.round((THUMB_WIDTH / DESIGN_WIDTH) * DESIGN_HEIGHT);

/** A small, non-interactive Fabric render of a slide — used in the left thumbnail rail so admins see actual content, not just a title label. */
export function SlideThumbnail({ slide }: { slide: InductionTrainingSlide }) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    lifecycleRef.current = lifecycleRef.current.then(async () => {
      if (cancelled || !canvasElRef.current || !slide.canvasJson) return;
      try {
        const { StaticCanvas } = await import("fabric");
        if (cancelled || !canvasElRef.current) return;
        const canvas = new StaticCanvas(canvasElRef.current, { width: THUMB_WIDTH, height: THUMB_HEIGHT });
        fabricRef.current = canvas;
        canvas.setZoom(THUMB_WIDTH / DESIGN_WIDTH);
        await canvas.loadFromJSON(slide.canvasJson);
        if (cancelled) return;
        canvas.renderAll();
      } catch {
        // A thumbnail failing to render isn't worth surfacing an error for —
        // the slide is still fully editable via the main canvas.
      }
    });
    return () => {
      cancelled = true;
      lifecycleRef.current = lifecycleRef.current.then(async () => {
        if (fabricRef.current) {
          await fabricRef.current.dispose();
          fabricRef.current = null;
        }
      });
    };
  }, [slide.id, slide.canvasJson]);

  if (!slide.canvasJson) {
    return (
      <div style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }} className="flex flex-col items-center justify-center gap-1 bg-bg p-2 text-center">
        <div className="line-clamp-2 text-[10px] font-bold text-text-dark">{slide.title || "Untitled"}</div>
        {slide.content && <div className="line-clamp-2 text-[9px] text-text-muted">{slide.content}</div>}
      </div>
    );
  }

  return <canvas ref={canvasElRef} width={THUMB_WIDTH} height={THUMB_HEIGHT} />;
}

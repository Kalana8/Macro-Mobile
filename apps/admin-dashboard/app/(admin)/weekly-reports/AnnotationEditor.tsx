"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoAnnotation, ReportPhoto } from "@macro/shared/types";
import { clearAnnotationAction, saveAnnotationAction } from "./actions";

type Tool = "select" | "circle" | "rect" | "line" | "arrow";

const COLORS = [
  { name: "Green", value: "#22c55e" },
  { name: "Sky Blue", value: "#38bdf8" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#ff7a1a" },
];

/**
 * Full-screen photo markup tool built on Fabric.js. Draws directly onto a
 * canvas seeded with the ORIGINAL photo — the original in report_photos is
 * never touched; Save rasterizes the whole canvas as a new PNG
 * (annotated_image_url) and also persists the Fabric object graph
 * (shapes_json) so this editor can reopen and keep editing later.
 */
export function AnnotationEditor({
  photo,
  reportId,
  annotation,
  onClose,
  onSaved,
}: {
  photo: ReportPhoto;
  reportId: string;
  annotation: PhotoAnnotation | undefined;
  onClose: () => void;
  onSaved: (annotation: PhotoAnnotation) => void;
}) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricModuleRef = useRef<any>(null);
  const drawingRef = useRef<{ shape: unknown; startX: number; startY: number } | null>(null);
  const historyRef = useRef<{ stack: string[]; index: number; restoring: boolean }>({ stack: [], index: -1, restoring: false });

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(COLORS[2].value); // Red default — most common "flag this" color
  const [strokeWidth, setStrokeWidth] = useState(4);
  // 0/90/180/270 — the PHOTO's own rotation, in 90° steps only. Shapes are
  // never rotated with it (or at all) — rotation applies to the photo only.
  const [photoAngle, setPhotoAngle] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // If the photo's host doesn't send CORS headers, loading it with
  // crossOrigin set fails outright — we retry without it so the photo still
  // shows and can be marked up; Save then can't rasterize a flattened PNG
  // (the canvas is "tainted"), so it falls back to shapes-only in that case.
  const taintedRef = useRef(false);
  // Serializes setup/teardown through one promise chain so a canvas is never
  // created before the previous one has fully finished disposing — Fabric's
  // dispose() is async, and without this, React's dev-mode double-invoke of
  // effects (mount → cleanup → mount, to catch bugs) can start building the
  // second canvas while the first is still mid-teardown, leaving the photo
  // visible but its mouse/touch listeners not actually wired up.
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;

    lifecycleRef.current = lifecycleRef.current.then(async () => {
      if (cancelled) return;
      try {
        const fabricModule = await import("fabric");
        if (cancelled || !canvasElRef.current) return;
        fabricModuleRef.current = fabricModule;
        const { Canvas, FabricImage } = fabricModule;

        const maxWidth = Math.min(containerRef.current?.clientWidth ?? 900, 900);
        let img;
        try {
          img = await FabricImage.fromURL(photo.original_url, { crossOrigin: "anonymous" });
        } catch {
          img = await FabricImage.fromURL(photo.original_url, {});
          taintedRef.current = true;
        }
        if (!img.width || !img.height) throw new Error("The photo couldn't be loaded.");

        const scale = Math.min(1, maxWidth / img.width);
        const canvasWidth = img.width * scale;
        const canvasHeight = img.height * scale;

        const canvas = new Canvas(canvasElRef.current, {
          width: canvasWidth,
          height: canvasHeight,
          selection: true,
        });
        fabricRef.current = canvas;
        // Fabric marks its canvas elements draggable="true" internally; left
        // alone, that lets the browser's own native drag-and-drop kick in
        // when dragging a shape, producing a ghost drag of the WHOLE canvas
        // (photo included) on top of Fabric's own object move — looking like
        // "the image moves too" whenever a shape is dragged.
        canvas.upperCanvasEl?.setAttribute("draggable", "false");
        canvas.lowerCanvasEl?.setAttribute("draggable", "false");

        // The photo is always added the same way — the freshly loaded,
        // already-decoded `img` from above — rather than ever letting
        // Fabric reconstruct it from saved JSON. Re-decoding a saved
        // "Image" object is async and happens after the canvas already
        // exists, which is exactly the kind of gap that's previously let
        // the upper/lower canvas layers or the canvas and its content end
        // up mismatched; adding the object we already have avoids that
        // gap entirely, and it's always the same photo.original_url anyway.
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, selectable: false, evented: false });
        canvas.add(img);
        canvas.sendObjectToBack(img);

        const hasExisting = annotation?.shapes_json && Object.keys(annotation.shapes_json).length > 0;
        if (hasExisting) {
          const savedObjects = ((annotation!.shapes_json as { objects?: unknown[] }).objects ?? []).filter(
            (o) => (o as { type?: string }).type !== "Image"
          );
          if (savedObjects.length > 0) {
            const { util } = fabricModuleRef.current;
            const shapes = await util.enlivenObjects(savedObjects);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shapes.forEach((s: any) => canvas.add(s));
          }
        }

        pushHistory(canvas);

        canvas.on("object:added", () => pushHistory(canvas));
        canvas.on("object:modified", () => pushHistory(canvas));
        canvas.on("object:removed", () => pushHistory(canvas));
        // Wrapped so any runtime error while drawing shows up as a visible
        // message instead of being silently swallowed inside Fabric's own
        // event dispatch (which would otherwise just look like "nothing
        // happens" when you drag on the photo).
        canvas.on("mouse:down", (opt: { e: MouseEvent | TouchEvent }) => {
          try {
            startDraw(canvas, opt);
          } catch (err) {
            setError(`Drawing failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        });
        canvas.on("mouse:move", (opt: { e: MouseEvent | TouchEvent }) => {
          try {
            continueDraw(canvas, opt);
          } catch (err) {
            setError(`Drawing failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        });
        canvas.on("mouse:up", () => {
          try {
            endDraw(canvas);
          } catch (err) {
            setError(`Drawing failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        });

        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load this photo for annotation.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushHistory(canvas: { toJSON: () => object }) {
    const h = historyRef.current;
    if (h.restoring) return;
    const json = JSON.stringify(canvas.toJSON());
    const trimmed = h.stack.slice(0, h.index + 1);
    trimmed.push(json);
    h.stack = trimmed;
    h.index = trimmed.length - 1;
    setCanUndo(h.index > 0);
    setCanRedo(false);
  }

  async function restoreHistory(index: number) {
    const canvas = fabricRef.current;
    const h = historyRef.current;
    if (!canvas || index < 0 || index >= h.stack.length) return;
    h.restoring = true;
    await canvas.loadFromJSON(JSON.parse(h.stack[index]));
    canvas.renderAll();
    h.index = index;
    h.restoring = false;
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
  }

  // Drawing uses the live `tool`/`color`/`strokeWidth` state via a ref, since
  // the Fabric event handlers are bound once in the mount effect and would
  // otherwise close over stale state.
  const toolStateRef = useRef({ tool, color, strokeWidth });
  toolStateRef.current = { tool, color, strokeWidth };

  // Built fresh (not incrementally updated) on every drag frame — simpler
  // and more reliable than trying to keep a Fabric Group's line+head in
  // sync, since grouping re-parents children into the group's own local
  // coordinate space and fights absolute-coordinate updates during a drag.
  function buildArrowPath(x1: number, y1: number, x2: number, y2: number, color: string, strokeWidth: number) {
    const { Path } = fabricModuleRef.current;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 8 + strokeWidth * 3;
    const headAngle = Math.PI / 7; // ~25.7°, a natural-looking arrowhead spread
    const hx1 = x2 - headLength * Math.cos(angle - headAngle);
    const hy1 = y2 - headLength * Math.sin(angle - headAngle);
    const hx2 = x2 - headLength * Math.cos(angle + headAngle);
    const hy2 = y2 - headLength * Math.sin(angle + headAngle);
    const d = `M ${x1} ${y1} L ${x2} ${y2} M ${hx1} ${hy1} L ${x2} ${y2} L ${hx2} ${hy2} Z`;
    return new Path(d, {
      stroke: color,
      strokeWidth,
      fill: color,
      strokeLineJoin: "round",
      strokeLineCap: "round",
      selectable: false,
      evented: false,
    });
  }

  function startDraw(canvas: any, opt: { e: MouseEvent | TouchEvent }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { tool: activeTool, color: activeColor, strokeWidth: activeStroke } = toolStateRef.current;
    if (activeTool === "select") return;
    const pointer = canvas.getPointer(opt.e);
    if (!pointer) return;
    const { Rect, Circle, Line } = fabricModuleRef.current;
    const common = { stroke: activeColor, strokeWidth: activeStroke, fill: "transparent", selectable: false, evented: false };

    let shape: unknown;
    if (activeTool === "rect") {
      shape = new Rect({ ...common, left: pointer.x, top: pointer.y, width: 1, height: 1 });
    } else if (activeTool === "circle") {
      shape = new Circle({ ...common, left: pointer.x, top: pointer.y, radius: 1, originX: "center", originY: "center" });
    } else if (activeTool === "line") {
      shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], { stroke: activeColor, strokeWidth: activeStroke, selectable: false, evented: false });
    } else {
      shape = buildArrowPath(pointer.x, pointer.y, pointer.x, pointer.y, activeColor, activeStroke);
    }

    canvas.add(shape);
    drawingRef.current = { shape, startX: pointer.x, startY: pointer.y };
  }

  function continueDraw(canvas: any, opt: { e: MouseEvent | TouchEvent }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const drawing = drawingRef.current;
    if (!drawing) return;
    const p = canvas.getPointer(opt.e);
    if (!p) return;
    const { tool: activeTool, color: activeColor, strokeWidth: activeStroke } = toolStateRef.current;
    const { shape, startX, startY } = drawing as { shape: any; startX: number; startY: number }; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (activeTool === "rect") {
      shape.set({ left: Math.min(startX, p.x), top: Math.min(startY, p.y), width: Math.abs(p.x - startX), height: Math.abs(p.y - startY) });
    } else if (activeTool === "circle") {
      const radius = Math.hypot(p.x - startX, p.y - startY) / 2;
      shape.set({ radius, left: (startX + p.x) / 2, top: (startY + p.y) / 2 });
    } else if (activeTool === "line") {
      shape.set({ x2: p.x, y2: p.y });
    } else if (activeTool === "arrow") {
      // remove+add fires object:removed/object:added, which would otherwise
      // push a new undo-history entry on every mousemove of the drag —
      // suppressed here the same way history-restore already is, so only
      // endDraw's explicit pushHistory captures the finished arrow.
      const h = historyRef.current;
      const wasRestoring = h.restoring;
      h.restoring = true;
      canvas.remove(shape);
      const newPath = buildArrowPath(startX, startY, p.x, p.y, activeColor, activeStroke);
      canvas.add(newPath);
      h.restoring = wasRestoring;
      drawingRef.current = { shape: newPath, startX, startY };
    }
    canvas.requestRenderAll();
  }

  function endDraw(canvas: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const drawing = drawingRef.current;
    if (!drawing) return;
    const shape = drawing.shape as { set: (props: object) => void };
    shape.set({ selectable: true, evented: true });
    drawingRef.current = null;
    pushHistory(canvas);
    setTool("select");
  }

  function applyToSelection(patch: Record<string, unknown>) {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject?.();
    if (active) {
      const finalPatch = { ...patch };
      // The arrow head is drawn filled, not just stroked — keep fill in
      // sync with stroke so a color change doesn't leave a two-tone arrow.
      if ("stroke" in finalPatch && active.fill && active.fill !== "transparent") {
        finalPatch.fill = finalPatch.stroke;
      }
      active.set(finalPatch);
      canvas.requestRenderAll();
      pushHistory(canvas);
    }
  }

  /** Axis-aligned bounding box of a width×height rectangle rotated by angleDeg. */
  function rotatedBoundingSize(width: number, height: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return { width: width * cos + height * sin, height: width * sin + height * cos };
  }

  /**
   * Rotates the PHOTO only, to any angle (0–359°, not just 90° steps) —
   * never the drawn shapes, which always stay exactly where they are in
   * canvas coordinates. Resizes the canvas to the photo's new rotated
   * bounding box so it isn't left cropped or with dead space around it.
   */
  function setPhotoRotation(angleDeg: number) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const bg = canvas.getObjects().find((o: { selectable: boolean }) => !o.selectable) as
      | { width: number; height: number; scaleX: number; scaleY: number; set: (p: object) => void; setCoords: () => void }
      | undefined;
    if (!bg) return;

    const naturalWidth = bg.width * bg.scaleX;
    const naturalHeight = bg.height * bg.scaleY;
    const { width: newCanvasWidth, height: newCanvasHeight } = rotatedBoundingSize(naturalWidth, naturalHeight, angleDeg);

    bg.set({
      angle: angleDeg,
      originX: "center",
      originY: "center",
      left: newCanvasWidth / 2,
      top: newCanvasHeight / 2,
    });
    bg.setCoords();
    canvas.setDimensions({ width: newCanvasWidth, height: newCanvasHeight });
    canvas.requestRenderAll();
    setPhotoAngle(angleDeg);
    pushHistory(canvas);
  }

  function deleteSelected() {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObjects?.() ?? [];
    active.forEach((o: unknown) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  function clearAll() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const bg = canvas.getObjects().find((o: { selectable: boolean }) => !o.selectable);
    canvas.getObjects().forEach((o: unknown) => {
      if (o !== bg) canvas.remove(o);
    });
    canvas.requestRenderAll();
  }

  async function handleSave() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setSaving(true);
    setError(null);
    try {
      // A canvas seeded from a photo without CORS permission is "tainted" —
      // reading it back out (toBlob) throws a SecurityError. Shapes are
      // still saved either way so annotations aren't lost; only the
      // pre-rendered PNG preview is skipped in that case.
      let blob: Blob | null = null;
      if (!taintedRef.current) {
        try {
          blob = await canvas.toBlob({ format: "png", multiplier: 2 });
        } catch {
          taintedRef.current = true;
        }
      }

      const formData = new FormData();
      formData.set("photoId", photo.id);
      formData.set("reportId", reportId);
      // Sent as a string field, not a nested object — Fabric's canvas JSON
      // nests deeply enough (groups, control points) to trip Next's
      // Server Action payload limits ("Maximum array nesting exceeded").
      formData.set("shapesJson", JSON.stringify(canvas.toJSON()));
      if (blob) formData.set("file", blob, `${photo.id}-annotated.png`);

      const result = await saveAnnotationAction(formData);
      if ("error" in result && result.error) throw new Error(result.error);
      if ("annotation" in result && result.annotation) {
        const saved = result.annotation as PhotoAnnotation & { shapes_json: string };
        onSaved({ ...saved, shapes_json: JSON.parse(saved.shapes_json) });
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the annotation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearAndReset() {
    clearAll();
    const result = await clearAnnotationAction(photo.id, reportId);
    if (!("error" in result) || !result.error) {
      onSaved({ id: annotation?.id ?? "", photo_id: photo.id, shapes_json: {}, annotated_image_url: null, updated_by: null, updated_at: new Date().toISOString() });
    }
  }

  const TOOLS: { key: Tool; label: string; icon: string }[] = [
    { key: "select", label: "Select / Move", icon: "↖" },
    { key: "circle", label: "Circle", icon: "○" },
    { key: "rect", label: "Rectangle", icon: "▭" },
    { key: "line", label: "Line", icon: "╱" },
    { key: "arrow", label: "Arrow", icon: "↗" },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[rgba(16,22,32,0.92)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-sm font-bold text-white">Annotate Photo</div>
        <button type="button" onClick={onClose} className="text-white/70" aria-label="Close">✕</button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-3 py-2.5 md:w-56 md:flex-col md:items-stretch md:border-b-0 md:border-r">
          <div className="flex gap-1.5 md:flex-col">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTool(t.key)}
                title={t.label}
                className={`flex h-10 w-10 items-center justify-center rounded-[10px] text-base font-bold md:w-full md:justify-start md:gap-2 md:px-3 ${
                  tool === t.key ? "bg-primary text-white" : "bg-white/10 text-white"
                }`}
              >
                <span>{t.icon}</span>
                <span className="hidden md:inline text-xs">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-1 flex items-center gap-1.5 md:mt-3 md:flex-col md:items-stretch">
            <div className="hidden text-[10px] font-bold uppercase tracking-wide text-white/50 md:block">Color</div>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setColor(c.value);
                    applyToSelection({ stroke: c.value });
                  }}
                  title={c.name}
                  aria-label={c.name}
                  style={{ background: c.value }}
                  className={`h-8 w-8 shrink-0 rounded-full border-2 ${color === c.value ? "border-white" : "border-transparent"}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-1 flex flex-1 items-center gap-2 md:mt-3 md:flex-none md:flex-col md:items-stretch">
            <div className="hidden text-[10px] font-bold uppercase tracking-wide text-white/50 md:block">Thickness</div>
            <input
              type="range"
              min={1}
              max={14}
              value={strokeWidth}
              onChange={(e) => {
                const w = Number(e.target.value);
                setStrokeWidth(w);
                applyToSelection({ strokeWidth: w });
              }}
              className="w-24 md:w-full"
            />
          </div>

          <div className="mt-1 flex items-center gap-1.5 md:mt-3 md:flex-col md:items-stretch">
            <div className="hidden text-[10px] font-bold uppercase tracking-wide text-white/50 md:block">
              Photo Rotation {Math.round(photoAngle)}°
            </div>
            <div className="flex w-full items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPhotoRotation((((photoAngle - 90) % 360) + 360) % 360)}
                title="Rotate photo left 90°"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-base font-bold text-white"
              >
                ↺
              </button>
              <input
                type="range"
                min={0}
                max={359}
                value={Math.round(photoAngle)}
                onChange={(e) => setPhotoRotation(Number(e.target.value))}
                title="Rotate photo to any angle"
                className="w-24 md:w-full"
              />
              <button
                type="button"
                onClick={() => setPhotoRotation((photoAngle + 90) % 360)}
                title="Rotate photo right 90°"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-base font-bold text-white"
              >
                ↻
              </button>
            </div>
          </div>
        </div>

        <div ref={containerRef} className="relative flex flex-1 items-center justify-center overflow-auto p-4">
          {/*
            This inner div is Fabric's alone once the canvas mounts — Fabric
            replaces/wraps the raw <canvas> with its own lower+upper canvas
            structure via direct DOM calls, outside React's tracking. React
            must never need to insert/remove a sibling inside here afterward
            (e.g. a conditional "Loading…" message), or its reconciliation
            can silently detach Fabric's real interactive canvas from what's
            on screen — the photo still renders, but drawing stops responding.
            The loading/error overlay below is a sibling of this div instead
            (inside the outer, React-only container), so it never touches
            this one's children.
          */}
          {/*
            Fabric creates a second "upper" canvas for handling clicks/drag,
            layered exactly on top of this one, and COPIES this element's
            className onto it verbatim. Any opaque background here (bg-white)
            would get duplicated onto that top layer too and hide everything
            underneath — so the canvas itself must stay unstyled; the visual
            frame (white background, rounded corners, shadow) lives on this
            wrapper div instead, which Fabric never touches or copies.
          */}
          <div className="flex items-center justify-center overflow-hidden rounded-lg bg-white shadow-2xl">
            <canvas ref={canvasElRef} />
          </div>

          {(loadError || !ready) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(16,22,32,0.92)]">
              {loadError ? (
                <div className="max-w-sm rounded-lg bg-white/10 p-5 text-center">
                  <div className="text-sm font-semibold text-white">Couldn&apos;t open this photo for annotation</div>
                  <div className="mt-1.5 text-xs text-white/70">{loadError}</div>
                  <button type="button" onClick={onClose} className="mt-4 rounded-lg border border-white/30 px-4 py-2 text-xs font-semibold text-white">
                    Close
                  </button>
                </div>
              ) : (
                <div className="text-sm text-white/70">Loading photo…</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => restoreHistory(historyRef.current.index - 1)} disabled={!canUndo} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white disabled:opacity-30">
            ↺ Undo
          </button>
          <button type="button" onClick={() => restoreHistory(historyRef.current.index + 1)} disabled={!canRedo} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white disabled:opacity-30">
            ↻ Redo
          </button>
          <button type="button" onClick={deleteSelected} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white">
            Delete Selected
          </button>
          <button type="button" onClick={handleClearAndReset} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white">
            Clear All
          </button>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-300">{error}</span>}
          <button type="button" onClick={onClose} className="rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold text-white">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save Annotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

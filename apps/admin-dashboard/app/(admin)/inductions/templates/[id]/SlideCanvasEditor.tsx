"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import type { InductionTrainingSlide } from "@macro/shared/types";
import { uploadTemplateAssetAction } from "../actions";
import { SLIDE_LAYOUTS } from "./slideLayouts";

const DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 540;
const EDITOR_ZOOM = 0.72;

const FONT_FAMILIES = ["Inter", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];
const COLORS = ["#16202e", "#0e62d1", "#ff7a1a", "#c0392b", "#5c6900", "#ffffff", "#6e7887"];

interface Selected {
  type: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: string;
  fill?: string;
  lineHeight?: number;
  charSpacing?: number;
  stroke?: string;
  strokeWidth?: number;
  rounded?: boolean;
}

function snapshotOf(obj: any): Selected {
  return {
    type: obj.type,
    fontFamily: obj.fontFamily,
    fontSize: obj.fontSize,
    bold: obj.fontWeight === "bold" || obj.fontWeight === 700,
    italic: obj.fontStyle === "italic",
    underline: Boolean(obj.underline),
    textAlign: obj.textAlign,
    fill: typeof obj.fill === "string" ? obj.fill : undefined,
    lineHeight: obj.lineHeight,
    charSpacing: obj.charSpacing,
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    rounded: Boolean(obj.clipPath),
  };
}

function ToolbarButton({ onClick, disabled, children, title }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-[8px] border border-border bg-white px-2.5 py-1.5 text-[12px] font-bold text-text-dark disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />;
}

/**
 * A PowerPoint-style canvas editor for one slide, built on Fabric.js — the
 * same library the Weekly Action Report's photo annotator already uses in
 * this app. Every element (text, image, shape, line) is a real Fabric
 * object with native drag/resize/rotate handles; the slide's full design is
 * persisted as `canvas.toJSON()`, so reopening it here (or rendering it
 * read-only for the employee) reproduces exactly what was built.
 */
export function SlideCanvasEditor({ slide, onChange }: { slide: InductionTrainingSlide; onChange: (patch: Partial<InductionTrainingSlide>) => void }) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const fabricModuleRef = useRef<any>(null);
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());
  const historyRef = useRef<{ stack: string[]; index: number; restoring: boolean }>({ stack: [], index: -1, restoring: false });
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showLayouts, setShowLayouts] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  function pushHistory(canvas: any) {
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

  useEffect(() => {
    let cancelled = false;

    lifecycleRef.current = lifecycleRef.current.then(async () => {
      if (cancelled || !canvasElRef.current) return;
      try {
        const fabricModule = await import("fabric");
        if (cancelled || !canvasElRef.current) return;
        fabricModuleRef.current = fabricModule;
        const { Canvas, Textbox } = fabricModule;

        const canvas = new Canvas(canvasElRef.current, {
          width: DESIGN_WIDTH * EDITOR_ZOOM,
          height: DESIGN_HEIGHT * EDITOR_ZOOM,
          backgroundColor: "#ffffff",
          preserveObjectStacking: true,
        });
        canvas.setZoom(EDITOR_ZOOM);
        fabricRef.current = canvas;
        // Same fix as the photo annotation editor: Fabric marks its canvas
        // elements draggable="true" internally, which otherwise triggers the
        // browser's native drag-and-drop (a ghost-drag of the whole canvas)
        // whenever an element is dragged.
        canvas.upperCanvasEl?.setAttribute("draggable", "false");
        canvas.lowerCanvasEl?.setAttribute("draggable", "false");

        if (slide.canvasJson && Object.keys(slide.canvasJson).length > 0) {
          await canvas.loadFromJSON(slide.canvasJson);
        } else if (slide.title || slide.content) {
          // One-time migration for a slide created before this editor existed
          // — seeds an editable title/body so it never opens to a blank canvas.
          if (slide.title) canvas.add(new Textbox(slide.title, { left: 60, top: 50, width: 840, fontSize: 40, fontWeight: "bold", fontFamily: "Inter", fill: "#16202e" }));
          if (slide.content) canvas.add(new Textbox(slide.content, { left: 60, top: 150, width: 840, fontSize: 22, fontFamily: "Inter", fill: "#16202e", lineHeight: 1.35 }));
        }
        canvas.renderAll();

        const syncSelection = () => {
          const active = canvas.getActiveObject();
          setSelected(active ? snapshotOf(active) : null);
        };
        canvas.on("selection:created", syncSelection);
        canvas.on("selection:updated", syncSelection);
        canvas.on("selection:cleared", () => setSelected(null));

        const emitChange = () => onChangeRef.current({ canvasJson: canvas.toJSON() });
        canvas.on("object:added", () => {
          pushHistory(canvas);
          emitChange();
        });
        canvas.on("object:removed", () => {
          pushHistory(canvas);
          emitChange();
        });
        canvas.on("object:modified", () => {
          pushHistory(canvas);
          emitChange();
          syncSelection();
        });

        pushHistory(canvas);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't open this slide for editing.");
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
  }, [slide.id]);

  function withCanvas(fn: (canvas: any, fabric: any) => void) {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;
    fn(canvas, fabric);
  }

  function addText() {
    withCanvas((canvas, fabric) => {
      const { Textbox } = fabric;
      const tb = new Textbox("New text", { left: 100, top: 100, width: 300, fontSize: 24, fontFamily: "Inter", fill: "#16202e" });
      canvas.add(tb);
      canvas.setActiveObject(tb);
      canvas.requestRenderAll();
    });
  }

  function addShape(kind: "rect" | "ellipse" | "triangle") {
    withCanvas((canvas, fabric) => {
      const { Rect, Ellipse, Triangle } = fabric;
      let shape: any;
      if (kind === "rect") shape = new Rect({ left: 150, top: 150, width: 220, height: 140, fill: "#0e62d1" });
      else if (kind === "ellipse") shape = new Ellipse({ left: 150, top: 150, rx: 110, ry: 70, fill: "#0e62d1" });
      else shape = new Triangle({ left: 150, top: 150, width: 180, height: 150, fill: "#0e62d1" });
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.requestRenderAll();
    });
    setShowShapeMenu(false);
  }

  function addLine() {
    withCanvas((canvas, fabric) => {
      const { Line } = fabric;
      const line = new Line([100, 300, 400, 300], { stroke: "#16202e", strokeWidth: 3 });
      canvas.add(line);
      canvas.setActiveObject(line);
      canvas.requestRenderAll();
    });
  }

  async function addImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadTemplateAssetAction(fd);
    setUploading(false);
    if (result.error || !result.url) return;
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;
    const { FabricImage } = fabric;
    let img;
    try {
      img = await FabricImage.fromURL(result.url, { crossOrigin: "anonymous" });
    } catch {
      img = await FabricImage.fromURL(result.url, {});
    }
    img.scaleToWidth(300);
    img.set({ left: 100, top: 100 });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  }

  async function replaceSelectedImage(file: File) {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !fabric || !active || active.type !== "Image") return;
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadTemplateAssetAction(fd);
    setUploading(false);
    if (result.error || !result.url) return;
    const { FabricImage } = fabric;
    let img;
    try {
      img = await FabricImage.fromURL(result.url, { crossOrigin: "anonymous" });
    } catch {
      img = await FabricImage.fromURL(result.url, {});
    }
    img.set({ left: active.left, top: active.top, scaleX: active.scaleX, scaleY: active.scaleY, angle: active.angle, clipPath: active.clipPath });
    canvas.remove(active);
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  }

  function deleteSelected() {
    withCanvas((canvas) => {
      canvas.getActiveObjects().forEach((o: any) => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    });
  }

  async function duplicateSelected() {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    const cloned = await active.clone();
    cloned.set({ left: (active.left ?? 0) + 24, top: (active.top ?? 0) + 24 });
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
  }

  function bringForward() {
    withCanvas((canvas) => {
      const active = canvas.getActiveObject();
      if (active) canvas.bringObjectForward(active);
      canvas.requestRenderAll();
    });
  }

  function sendBackward() {
    withCanvas((canvas) => {
      const active = canvas.getActiveObject();
      if (active) canvas.sendObjectBackwards(active);
      canvas.requestRenderAll();
    });
  }

  function applyToSelected(patch: Record<string, unknown>) {
    withCanvas((canvas) => {
      const active = canvas.getActiveObject();
      if (!active) return;
      active.set(patch);
      canvas.requestRenderAll();
      pushHistory(canvas);
      onChangeRef.current({ canvasJson: canvas.toJSON() });
      setSelected(snapshotOf(active));
    });
  }

  function toggleRoundedCorners(on: boolean) {
    withCanvas((canvas, fabric) => {
      const active = canvas.getActiveObject();
      if (!active || active.type !== "Image") return;
      const { Rect } = fabric;
      if (on) {
        const w = active.width ?? 0;
        const h = active.height ?? 0;
        active.clipPath = new Rect({ width: w, height: h, rx: Math.min(w, h) * 0.12, ry: Math.min(w, h) * 0.12, originX: "center", originY: "center" });
      } else {
        active.clipPath = undefined;
      }
      canvas.requestRenderAll();
      pushHistory(canvas);
      onChangeRef.current({ canvasJson: canvas.toJSON() });
      setSelected(snapshotOf(active));
    });
  }

  function setBackgroundColor(color: string) {
    withCanvas((canvas) => {
      canvas.backgroundImage = undefined;
      canvas.backgroundColor = color;
      canvas.requestRenderAll();
      pushHistory(canvas);
      onChangeRef.current({ canvasJson: canvas.toJSON() });
    });
  }

  async function setBackgroundImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadTemplateAssetAction(fd);
    setUploading(false);
    if (result.error || !result.url) return;
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;
    const { FabricImage } = fabric;
    let img;
    try {
      img = await FabricImage.fromURL(result.url, { crossOrigin: "anonymous" });
    } catch {
      img = await FabricImage.fromURL(result.url, {});
    }
    img.set({ scaleX: DESIGN_WIDTH / (img.width || DESIGN_WIDTH), scaleY: DESIGN_HEIGHT / (img.height || DESIGN_HEIGHT) });
    canvas.backgroundImage = img;
    canvas.requestRenderAll();
    pushHistory(canvas);
    onChangeRef.current({ canvasJson: canvas.toJSON() });
  }

  function applyLayout(key: string) {
    withCanvas((canvas, fabric) => {
      canvas.discardActiveObject();
      canvas.getObjects().forEach((o: any) => canvas.remove(o));
      canvas.backgroundImage = undefined;
      const layout = SLIDE_LAYOUTS.find((l) => l.key === key);
      layout?.apply(fabric, canvas);
      canvas.requestRenderAll();
      pushHistory(canvas);
      setSelected(null);
      onChangeRef.current({ canvasJson: canvas.toJSON() });
    });
    setShowLayouts(false);
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
    setSelected(null);
    onChangeRef.current({ canvasJson: canvas.toJSON() });
  }

  const isText = selected?.type === "Textbox";
  const isImage = selected?.type === "Image";
  const isShape = selected?.type === "Rect" || selected?.type === "Ellipse" || selected?.type === "Triangle";
  const isLine = selected?.type === "Line";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] border border-border bg-white p-2">
        <ToolbarButton onClick={addText} title="Add text box">+ Text</ToolbarButton>
        <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Add image">
          {uploading ? "Uploading…" : "+ Image"}
        </ToolbarButton>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addImage(f); e.target.value = ""; }} />
        <div className="relative">
          <ToolbarButton onClick={() => setShowShapeMenu((v) => !v)} title="Add shape">+ Shape</ToolbarButton>
          {showShapeMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 flex flex-col gap-1 rounded-[10px] border border-border bg-white p-1.5 shadow-lg">
              <button type="button" onClick={() => addShape("rect")} className="rounded-md px-3 py-1.5 text-left text-xs font-semibold text-text-dark hover:bg-bg">▭ Rectangle</button>
              <button type="button" onClick={() => addShape("ellipse")} className="rounded-md px-3 py-1.5 text-left text-xs font-semibold text-text-dark hover:bg-bg">◯ Ellipse</button>
              <button type="button" onClick={() => addShape("triangle")} className="rounded-md px-3 py-1.5 text-left text-xs font-semibold text-text-dark hover:bg-bg">△ Triangle</button>
            </div>
          )}
        </div>
        <ToolbarButton onClick={addLine} title="Add line">+ Line</ToolbarButton>
        <ToolbarButton onClick={() => setShowLayouts(true)} title="Choose a layout">Layouts</ToolbarButton>
        <Divider />
        <ToolbarButton onClick={duplicateSelected} disabled={!selected} title="Duplicate">Duplicate</ToolbarButton>
        <ToolbarButton onClick={deleteSelected} disabled={!selected} title="Delete">Delete</ToolbarButton>
        <ToolbarButton onClick={bringForward} disabled={!selected} title="Bring forward">Forward</ToolbarButton>
        <ToolbarButton onClick={sendBackward} disabled={!selected} title="Send backward">Backward</ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => restoreHistory(historyRef.current.index - 1)} disabled={!canUndo} title="Undo">↺ Undo</ToolbarButton>
        <ToolbarButton onClick={() => restoreHistory(historyRef.current.index + 1)} disabled={!canRedo} title="Redo">↻ Redo</ToolbarButton>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex flex-1 items-center justify-center overflow-auto rounded-[12px] border border-border bg-[#eef0f3] p-4">
          <div className="overflow-hidden rounded-md bg-white shadow-md">
            <canvas ref={canvasElRef} />
          </div>
          {(loadError || !ready) && (
            <div className="text-xs text-text-muted">{loadError ?? "Loading slide…"}</div>
          )}
        </div>

        <div className="w-full shrink-0 rounded-[12px] border border-border bg-white p-3 lg:w-72">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-muted">Slide Background</div>
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setBackgroundColor(c)} style={{ background: c }} className="h-6 w-6 rounded-full border border-border" aria-label={c} />
            ))}
            <label className="cursor-pointer rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-text-dark">
              Image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setBackgroundImage(f); e.target.value = ""; }} />
            </label>
          </div>

          {!selected && <p className="text-xs text-text-muted">Select an element on the slide to edit its properties.</p>}

          {isText && (
            <div className="flex flex-col gap-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Text</div>
              <select value={selected?.fontFamily ?? "Inter"} onChange={(e) => applyToSelected({ fontFamily: e.target.value })} className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs">
                {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <input type="number" min={8} max={120} value={selected?.fontSize ?? 24} onChange={(e) => applyToSelected({ fontSize: Number(e.target.value) })} className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-xs" />
                <span className="text-[11px] text-text-muted">Size</span>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => applyToSelected({ fontWeight: selected?.bold ? "normal" : "bold" })} className={`flex-1 rounded-md border border-border py-1.5 text-xs font-extrabold ${selected?.bold ? "bg-primary text-white" : "text-text-dark"}`}>B</button>
                <button type="button" onClick={() => applyToSelected({ fontStyle: selected?.italic ? "normal" : "italic" })} className={`flex-1 rounded-md border border-border py-1.5 text-xs italic ${selected?.italic ? "bg-primary text-white" : "text-text-dark"}`}>I</button>
                <button type="button" onClick={() => applyToSelected({ underline: !selected?.underline })} className={`flex-1 rounded-md border border-border py-1.5 text-xs underline ${selected?.underline ? "bg-primary text-white" : "text-text-dark"}`}>U</button>
              </div>
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a} type="button" onClick={() => applyToSelected({ textAlign: a })} className={`flex-1 rounded-md border border-border py-1.5 text-[11px] font-semibold ${selected?.textAlign === a ? "bg-primary text-white" : "text-text-dark"}`}>
                    {a[0].toUpperCase()}
                  </button>
                ))}
              </div>
              <div>
                <div className="mb-1 text-[11px] text-text-muted">Color</div>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => applyToSelected({ fill: c })} style={{ background: c }} className={`h-6 w-6 rounded-full border ${selected?.fill === c ? "border-primary border-2" : "border-border"}`} aria-label={c} />
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between text-[11px] text-text-muted">
                Line spacing
                <input type="number" step={0.1} min={0.8} max={3} value={selected?.lineHeight ?? 1.16} onChange={(e) => applyToSelected({ lineHeight: Number(e.target.value) })} className="w-16 rounded-md border border-border bg-bg px-2 py-1 text-xs" />
              </label>
              <label className="flex items-center justify-between text-[11px] text-text-muted">
                Letter spacing
                <input type="number" step={10} value={selected?.charSpacing ?? 0} onChange={(e) => applyToSelected({ charSpacing: Number(e.target.value) })} className="w-16 rounded-md border border-border bg-bg px-2 py-1 text-xs" />
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const canvas = fabricRef.current;
                    const active = canvas?.getActiveObject();
                    if (!active) return;
                    const withBullets = String(active.text ?? "").split("\n").map((l: string) => (l.trim() ? `• ${l.replace(/^•\s*/, "")}` : l)).join("\n");
                    applyToSelected({ text: withBullets });
                  }}
                  className="flex-1 rounded-md border border-border py-1.5 text-[11px] font-semibold text-text-dark"
                >
                  • Bullets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const canvas = fabricRef.current;
                    const active = canvas?.getActiveObject();
                    if (!active) return;
                    let n = 0;
                    const numbered = String(active.text ?? "")
                      .split("\n")
                      .map((l: string) => {
                        const clean = l.replace(/^\d+\.\s*/, "").replace(/^•\s*/, "");
                        if (!clean.trim()) return l;
                        n += 1;
                        return `${n}. ${clean}`;
                      })
                      .join("\n");
                    applyToSelected({ text: numbered });
                  }}
                  className="flex-1 rounded-md border border-border py-1.5 text-[11px] font-semibold text-text-dark"
                >
                  1. Numbers
                </button>
              </div>
            </div>
          )}

          {isImage && (
            <div className="flex flex-col gap-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Image</div>
              <button type="button" onClick={() => replaceInputRef.current?.click()} className="rounded-md border border-border py-1.5 text-xs font-semibold text-text-dark">
                {uploading ? "Uploading…" : "Replace Image"}
              </button>
              <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceSelectedImage(f); e.target.value = ""; }} />
              <label className="flex items-center justify-between text-[11px] text-text-muted">
                Rounded corners
                <input type="checkbox" checked={Boolean(selected?.rounded)} onChange={(e) => toggleRoundedCorners(e.target.checked)} className="h-4 w-4" />
              </label>
            </div>
          )}

          {(isShape || isLine) && (
            <div className="flex flex-col gap-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{isLine ? "Line" : "Shape"}</div>
              {!isLine && (
                <div>
                  <div className="mb-1 text-[11px] text-text-muted">Fill</div>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => applyToSelected({ fill: c })} style={{ background: c }} className={`h-6 w-6 rounded-full border ${selected?.fill === c ? "border-primary border-2" : "border-border"}`} aria-label={c} />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-1 text-[11px] text-text-muted">Stroke</div>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => applyToSelected({ stroke: c })} style={{ background: c }} className={`h-6 w-6 rounded-full border ${selected?.stroke === c ? "border-primary border-2" : "border-border"}`} aria-label={c} />
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between text-[11px] text-text-muted">
                Stroke width
                <input type="number" min={0} max={20} value={selected?.strokeWidth ?? 1} onChange={(e) => applyToSelected({ strokeWidth: Number(e.target.value) })} className="w-16 rounded-md border border-border bg-bg px-2 py-1 text-xs" />
              </label>
            </div>
          )}
        </div>
      </div>

      {showLayouts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,32,46,0.45)] p-4" onClick={() => setShowLayouts(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-3 text-sm font-bold text-text-dark">Choose a Layout</div>
            <p className="mb-3 text-xs text-text-muted">Replaces everything on this slide — the layout is a starting point you can fully customize afterward.</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {SLIDE_LAYOUTS.map((l) => (
                <button key={l.key} type="button" onClick={() => applyLayout(l.key)} className="rounded-[10px] border border-border p-3 text-left text-xs font-semibold text-text-dark hover:border-primary hover:bg-primary/5">
                  {l.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowLayouts(false)} className="mt-4 w-full rounded-[10px] border border-border py-2 text-sm font-semibold text-text-dark">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

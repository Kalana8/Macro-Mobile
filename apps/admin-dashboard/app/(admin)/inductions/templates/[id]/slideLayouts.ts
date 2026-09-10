// Layout factories run against a LIVE fabric canvas + the dynamically
// imported fabric module, so whatever they produce is always exactly what
// fabric itself expects — safer than hand-authoring raw canvas JSON and
// hoping it matches fabric's internal serialization format.
/* eslint-disable @typescript-eslint/no-explicit-any */

const NAVY = "#16202e";
const MUTED = "#6e7887";
const WHITE = "#ffffff";
const PRIMARY = "#0e62d1";
const ORANGE = "#ff7a1a";
const RED = "#c0392b";
const AMBER = "#8a6d1a";

function title(fabric: any, canvas: any, text: string, opts: Record<string, unknown> = {}) {
  const { Textbox } = fabric;
  canvas.add(new Textbox(text, { left: 60, top: 50, width: 840, fontSize: 40, fontWeight: "bold", fontFamily: "Inter", fill: NAVY, textAlign: "left", ...opts }));
}

function body(fabric: any, canvas: any, text: string, opts: Record<string, unknown> = {}) {
  const { Textbox } = fabric;
  canvas.add(new Textbox(text, { left: 60, top: 150, width: 840, fontSize: 22, fontFamily: "Inter", fill: NAVY, lineHeight: 1.35, ...opts }));
}

export interface SlideLayout {
  key: string;
  label: string;
  apply: (fabric: any, canvas: any) => void;
}

export const SLIDE_LAYOUTS: SlideLayout[] = [
  {
    key: "title",
    label: "Title Slide",
    apply(fabric, canvas) {
      canvas.backgroundColor = WHITE;
      title(fabric, canvas, "Slide Title", { left: 80, top: 210, width: 800, fontSize: 54, textAlign: "center" });
      body(fabric, canvas, "Subtitle or description", { left: 80, top: 300, width: 800, fontSize: 22, textAlign: "center", fill: MUTED });
    },
  },
  {
    key: "title_content",
    label: "Title + Content",
    apply(fabric, canvas) {
      canvas.backgroundColor = WHITE;
      title(fabric, canvas, "Slide Title");
      body(fabric, canvas, "Add your content here. Double-click to edit this text box.");
    },
  },
  {
    key: "two_column",
    label: "Two Content",
    apply(fabric, canvas) {
      canvas.backgroundColor = WHITE;
      title(fabric, canvas, "Slide Title");
      body(fabric, canvas, "Left column content…", { left: 60, top: 150, width: 400 });
      body(fabric, canvas, "Right column content…", { left: 500, top: 150, width: 400 });
    },
  },
  {
    key: "image_text",
    label: "Image + Text",
    apply(fabric, canvas) {
      const { Rect } = fabric;
      canvas.backgroundColor = WHITE;
      title(fabric, canvas, "Slide Title");
      canvas.add(new Rect({ left: 60, top: 150, width: 380, height: 320, fill: "#e4e8ef", rx: 8, ry: 8 }));
      body(fabric, canvas, "Add descriptive text here.", { left: 480, top: 170, width: 420 });
    },
  },
  {
    key: "full_image",
    label: "Full Image",
    apply(fabric, canvas) {
      const { Rect } = fabric;
      canvas.backgroundColor = "#e4e8ef";
      canvas.add(new Rect({ left: 0, top: 0, width: 960, height: 540, fill: "#e4e8ef", selectable: true }));
      title(fabric, canvas, "Add an image, then this caption", { left: 60, top: 460, width: 840, fontSize: 26, fill: NAVY });
    },
  },
  {
    key: "safety_warning",
    label: "Safety Warning",
    apply(fabric, canvas) {
      canvas.backgroundColor = RED;
      title(fabric, canvas, "⚠ Safety Warning", { fill: WHITE, fontSize: 46 });
      body(fabric, canvas, "Describe the safety warning here.", { fill: WHITE, fontSize: 24 });
    },
  },
  {
    key: "ppe",
    label: "PPE Information",
    apply(fabric, canvas) {
      canvas.backgroundColor = PRIMARY;
      title(fabric, canvas, "Personal Protective Equipment", { fill: WHITE, fontSize: 36 });
      body(fabric, canvas, "List the required PPE items here.", { fill: WHITE });
    },
  },
  {
    key: "emergency",
    label: "Emergency Procedure",
    apply(fabric, canvas) {
      canvas.backgroundColor = ORANGE;
      title(fabric, canvas, "Emergency Procedure", { fill: WHITE, fontSize: 40 });
      body(fabric, canvas, "Describe emergency exits, alarms, and the assembly point.", { fill: WHITE });
    },
  },
  {
    key: "hazard",
    label: "Hazard Information",
    apply(fabric, canvas) {
      canvas.backgroundColor = AMBER;
      title(fabric, canvas, "Hazard Information", { fill: WHITE, fontSize: 40 });
      body(fabric, canvas, "Describe the hazard and how to work safely around it.", { fill: WHITE });
    },
  },
  {
    key: "blank",
    label: "Blank",
    apply(fabric, canvas) {
      canvas.backgroundColor = WHITE;
    },
  },
];

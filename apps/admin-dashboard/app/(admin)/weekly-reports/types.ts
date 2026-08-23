import type { PhotoAnnotation, ReportPhoto, ReportSection, WeeklyReport } from "@macro/shared/types";

export interface SectionWithPhotos extends ReportSection {
  photos: ReportPhoto[];
}

export interface ReportWithDetail extends WeeklyReport {
  companyName: string;
  siteName: string | null;
  auditorName: string;
  supervisorName: string;
}

export type AnnotationsByPhotoId = Record<string, PhotoAnnotation>;

// "Wire" shape used only for the server-component → client-component
// crossing (the initial page render): shapes_json travels as a JSON string
// rather than a plain object, because Fabric's canvas JSON (groups, control
// points) can nest deeply enough to trip Next's Flight serializer's
// array-nesting guard ("Maximum array nesting exceeded") once a real
// annotation has been saved. Parsed back into AnnotationsByPhotoId
// immediately on the client — every other place in the app uses the real
// (parsed) shape.
export type WireAnnotation = Omit<PhotoAnnotation, "shapes_json"> & { shapes_json: string };
export type WireAnnotationsByPhotoId = Record<string, WireAnnotation>;

export function parseWireAnnotations(wire: WireAnnotationsByPhotoId): AnnotationsByPhotoId {
  const result: AnnotationsByPhotoId = {};
  for (const [photoId, a] of Object.entries(wire)) {
    let shapes_json: Record<string, unknown> = {};
    try {
      shapes_json = JSON.parse(a.shapes_json || "{}");
    } catch {
      // leave as {} — treated the same as "no annotation yet"
    }
    result[photoId] = { ...a, shapes_json };
  }
  return result;
}

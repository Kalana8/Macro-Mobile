/** Reads the hidden visitDates[] fields written by VisitScheduleFields into the shape checklist_templates.visit_dates expects. */
export function parseVisitSchedule(formData: FormData) {
  return {
    visit_dates: formData.getAll("visitDates").map(String).filter(Boolean),
  };
}

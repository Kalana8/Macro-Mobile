-- Simplify Weekly Action Report sections/photos per user feedback: one note
-- area and one photo area per section is enough — more content means adding
-- another section, not more fields within one. No before/after distinction.

alter table report_sections rename column observation to notes;
alter table report_sections drop column required_improvement;
alter table report_sections drop column action_taken;
alter table report_sections drop column additional_notes;

alter table report_photos drop column category;
drop type report_photo_category;

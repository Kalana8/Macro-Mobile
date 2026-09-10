-- Turns the induction assignment from a one-shot questionnaire into a full
-- Training -> Assessment -> Retake -> Certification flow. Training slides
-- and per-question grading config stay jsonb (same reasoning as
-- sections/questions — flexible, no restructuring needed for future slide
-- fields), matching the existing convention on induction_templates.
alter table induction_templates
  add column if not exists training_slides jsonb not null default '[]'::jsonb,
  add column if not exists pass_mark_percent int not null default 100,
  add column if not exists max_attempts int,
  add column if not exists retake_delay_hours int not null default 0,
  add column if not exists shuffle_questions boolean not null default false,
  add column if not exists shuffle_options boolean not null default false,
  add column if not exists show_correct_answers boolean not null default true,
  add column if not exists certificate_enabled boolean not null default true;

-- Every assessment attempt is appended here, never overwritten — this is
-- what lets the system "preserve the complete assessment history" across
-- retakes without a separate attempts table, consistent with how the rest
-- of this schema stores structured-but-flexible data as jsonb.
alter table induction_submissions
  add column if not exists attempts jsonb not null default '[]'::jsonb,
  add column if not exists training_progress jsonb not null default '{}'::jsonb,
  add column if not exists training_completed_at timestamptz;

-- A failed attempt is a distinct, retakeable state — different from
-- "completed" (which now specifically means "passed", see submitAssessmentAction).
alter type induction_submission_status add value if not exists 'failed';

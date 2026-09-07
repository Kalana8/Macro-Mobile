-- Replaces the fixed content-block model with a dynamic, Google Forms–style
-- assignment builder: an induction template is now Sections → Questions,
-- where each question has a type (short answer, paragraph, multiple choice,
-- checkboxes, dropdown, yes/no, true/false, date, time, file/image/video
-- upload), options, and a required flag — not a fixed set of blocks.

create type induction_template_status as enum ('draft', 'published');

alter table induction_templates add column if not exists category text not null default '';
alter table induction_templates add column if not exists status induction_template_status not null default 'draft';
alter table induction_templates add column if not exists cover_image_url text;

-- "blocks" (content/acknowledgement) -> "sections" (title/description/
-- questions[]) — a different enough shape that this replaces rather than
-- transforms the existing column. No real submissions exist against the
-- current seed template, so it's reset to a sensible new-shape default
-- rather than attempting a lossy field-by-field conversion.
alter table induction_templates rename column blocks to sections;
update induction_templates
set sections = '[
  {
    "id": "general",
    "title": "General Induction",
    "description": "Please answer the following questions before starting work at this site.",
    "questions": [
      {
        "id": "q-name-confirm",
        "type": "short_answer",
        "title": "Please type your full name to confirm your identity.",
        "required": true
      },
      {
        "id": "q-site-rules",
        "type": "yes_no",
        "title": "Have you read and understood the site safety rules?",
        "required": true
      },
      {
        "id": "q-ppe",
        "type": "yes_no",
        "title": "Do you understand the PPE requirements for this site?",
        "required": true
      },
      {
        "id": "q-hazards",
        "type": "checkboxes",
        "title": "Which of the following hazards have you been made aware of?",
        "required": true,
        "options": ["Moving vehicles", "Working at height", "Manual handling", "Electrical hazards"]
      }
    ]
  }
]'::jsonb,
status = 'published'
where jsonb_typeof(sections) = 'array';

-- induction_submissions: "acknowledgements" (Record<blockId, boolean>)
-- becomes "answers" (Record<questionId, AnswerValue>) — answers can be a
-- string, string[], or an uploaded file's URL, so this stays jsonb rather
-- than a typed column, same reasoning as the old field.
alter table induction_submissions rename column acknowledgements to answers;

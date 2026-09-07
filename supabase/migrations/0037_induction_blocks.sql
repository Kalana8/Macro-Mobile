-- Upgrades induction template "sections" (a flat list of checkbox labels)
-- into real content BLOCKS — matching the block-based template editor
-- pattern (numbered blocks, drag-reorder, visibility toggle, rich content)
-- already used elsewhere in this app for document templates.

alter table induction_templates rename column sections to blocks;

-- Migrate the existing seed data into the new block shape: each old
-- {id,label} checkbox item becomes an "acknowledgement" block, prefixed
-- with a "content" welcome block so there's something to read first.
update induction_templates
set blocks = (
  '[{"id":"welcome","type":"content","title":"Welcome","content":"<p>Welcome to the site. Please read the following induction information carefully.</p>","visible":true}]'::jsonb
  ||
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', item->>'id',
      'type', 'acknowledgement',
      'title', item->>'label',
      'content', item->>'label',
      'visible', true
    )), '[]'::jsonb)
    from jsonb_array_elements(blocks) as item
  )
)
where jsonb_typeof(blocks) = 'array';

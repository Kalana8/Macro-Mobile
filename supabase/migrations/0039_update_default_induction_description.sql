-- Replaces the seeded "Standard Site Induction" template's short placeholder
-- description with the full site-safety copy the admin actually wants shown
-- on the employee-facing intro screen.
update induction_templates
set description = 'This site safety induction provides essential information on site rules, personal protective equipment (PPE), emergency procedures, and workplace hazards. All workers and visitors must follow site rules, procedures, and instructions while on site. The required PPE must be worn correctly and maintained throughout relevant work activities. Work areas should be kept clean, organised, and free from avoidable hazards. Any hazards, unsafe conditions, incidents, or near misses must be reported to the appropriate site contact. Everyone should be familiar with emergency exits, first-aid facilities, fire equipment, and the designated emergency assembly point. In an emergency, stop work and follow the site''s emergency and evacuation procedures while following instructions from authorised site personnel.',
    updated_at = now()
where name = 'Standard Site Induction'
  and description = 'Default site safety induction — site rules, PPE, emergency procedures, and hazards.';

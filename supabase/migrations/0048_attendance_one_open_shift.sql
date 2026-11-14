-- An employee can be clocked in at only one site at a time: at most one
-- attendance row per employee may be open (no clock-out yet). A second
-- clock-in while a shift is open fails with a unique violation (23505).
create unique index if not exists attendance_one_open_shift
  on public.attendance (employee_id)
  where clock_out_at is null;

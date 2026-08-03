-- Row Level Security had been turned OFF on `communications` on the live
-- database (a manual workaround from before 0014 added the recipient UPDATE
-- policy that let employees' message sends update the thread row). With RLS
-- disabled, every scoped policy on the table — including
-- `communications_employee_select` (is_communication_recipient(id)) — was
-- inert, so ANY authenticated user's Comm Log and home notification bell
-- queried back EVERY thread in the database, not just the ones they're a
-- recipient of. 0002 already enables RLS here; this restores that state after
-- the drift. Idempotent — safe to run whether or not RLS is currently on.
alter table communications enable row level security;

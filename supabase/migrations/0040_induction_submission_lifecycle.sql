-- The employee-facing submit flow no longer routes every submission through
-- a mandatory "pending_approval" gate before the employee sees a completed
-- certificate — the certificate is generated the moment the form is
-- submitted (spec: "certificate must be generated from the successfully
-- submitted induction data", independent of any later admin review).
-- 'completed' is the new default post-submit status; 'pending_approval' is
-- kept as an optional state an admin can still move a submission into/out
-- of via Approve/Reject, and 'expired' lets a lapsed certificate be
-- reflected on the submission itself, not just on induction_certificates.
alter type induction_submission_status add value if not exists 'completed';
alter type induction_submission_status add value if not exists 'expired';

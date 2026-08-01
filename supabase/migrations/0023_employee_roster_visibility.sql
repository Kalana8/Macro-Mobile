-- The new-communication recipient picker needs an employee to see the
-- roster of who else shares their company — employee_companies_self_select
-- and employees_self_select only ever let them see their OWN row, so the
-- picker always came back empty. Both additions are additive (OR'd with
-- the existing self/admin policies) and scoped to "shares a company with
-- me", not a broad employee-directory leak.
create policy employee_companies_company_select on employee_companies for select to authenticated
  using (company_id in (select user_company_ids()));

create policy employees_company_select on employees for select to authenticated
  using (
    exists (
      select 1 from employee_companies ec
      where ec.employee_id = employees.id
        and ec.company_id in (select user_company_ids())
    )
  );

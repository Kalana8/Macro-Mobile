"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import type { Company, Site } from "@macro/shared/types";
import { deleteCompanyAction, removeEmployeeFromCompanyAction } from "./actions";
import { CompanyModal } from "./CompanyModal";
import { AssignEmployeeModal } from "./[companyId]/AssignEmployeeModal";

export interface CompanyEmployeeRow {
  id: string;
  name: string;
  role: string;
  checklistSummary: string;
  /** The company's sites they work at. */
  siteIds: string[];
}

export function CompaniesTable({
  companies,
  companyEmployees,
  allEmployees,
  sitesByCompany,
}: {
  companies: Company[];
  companyEmployees: Record<string, CompanyEmployeeRow[]>;
  allEmployees: { id: string; full_name: string }[];
  sitesByCompany: Record<string, Site[]>;
}) {
  const siteNamesByCompany: Record<string, string[]> = {};
  for (const [companyId, sites] of Object.entries(sitesByCompany)) {
    siteNamesByCompany[companyId] = sites.map((s) => s.name);
  }
  const existingSiteNames = Array.from(new Set(Object.values(siteNamesByCompany).flat())).sort();
  const [modalCompany, setModalCompany] = useState<Company | "new" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState<{ company: Company; site: Site | null } | null>(null);
  const router = useRouter();

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <PrimaryButton onClick={() => setModalCompany("new")}>
          <PlusIcon />
          Add Company
        </PrimaryButton>
      </div>

      {companies.length === 0 ? (
        <EmptyState title="No companies yet" hint="Register your first company to get started." />
      ) : (
      // One row per site: the company's name on its first site, its other sites on the rows below.
      <Table head={["", "Company", "Site Name", "Employees", "Status", "Actions"]}>
        {companies.flatMap((company) => {
          const sites: (Site | null)[] = sitesByCompany[company.id]?.length ? sitesByCompany[company.id] : [null];
          return sites.map((site, i) => {
            const key = `${company.id}:${site?.id ?? "none"}`;
            const isExpanded = expandedId === key;
            const first = i === 0;
            const last = i === sites.length - 1;
            const roster = (companyEmployees[company.id] ?? []).filter((e) => !site || e.siteIds.includes(site.id));
            const open = () => router.push(`/companies/${company.id}`);
            return (
              <Fragment key={key}>
                <tr className={last ? "border-b border-border last:border-0" : "border-b border-border/50"}>
                  <td className="w-5 cursor-pointer px-5 py-3.5" onClick={() => setExpandedId(isExpanded ? null : key)}>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      className={`text-text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </td>
                  <td className="cursor-pointer px-5 py-3.5 font-semibold text-text-dark" onClick={open}>
                    {company.name}
                  </td>
                  <td className="cursor-pointer px-5 py-3.5 text-text-dark" onClick={open}>
                    {site?.name ?? "—"}
                  </td>
                  <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={open}>
                    {roster.length}
                  </td>
                  <td className="cursor-pointer px-5 py-3.5" onClick={open}>
                    {first && (
                      <Badge tone={company.status === "active" ? "success" : "neutral"}>
                        {company.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <IconChip onClick={() => setAssignTo({ company, site })} aria-label={`Add Employee to ${site?.name ?? company.name}`} title="Add Employee">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="9" cy="8" r="3.2" /><path d="M2.5 19c1-3.5 4-5.2 6.5-5.2s5.5 1.7 6.5 5.2" /><path d="M17 8v6M14 11h6" />
                        </svg>
                      </IconChip>
                      {first && (
                        <>
                          <IconChip onClick={() => setModalCompany(company)} aria-label="Edit" title="Edit">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </IconChip>
                          <DeleteButton
                            action={deleteCompanyAction}
                            confirmText={`Delete ${company.name} and all its sites? This can't be undone.`}
                            hiddenFields={{ id: company.id }}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-bg">
                    <td colSpan={6} className="px-5 py-4" style={{ paddingLeft: 52 }}>
                      <div className="mb-2 text-[11px] font-bold text-text-muted">EMPLOYEES{site ? ` · ${site.name.toUpperCase()}` : ""}</div>
                      {roster.length === 0 ? (
                        <div className="text-xs text-text-muted">No employees assigned.</div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {roster.map((e) => (
                            <div key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3.5 py-2.5">
                              <div>
                                <div className="text-[13px] font-semibold text-text-dark">{e.name}</div>
                                <div className="text-[11.5px] text-text-muted">{e.role}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="rounded-md bg-bg px-2.5 py-1 text-[11.5px] font-semibold text-text-muted">
                                  {e.checklistSummary}
                                </div>
                                <DeleteButton
                                  action={removeEmployeeFromCompanyAction}
                                  confirmText={`Remove ${e.name} from ${site ? `${company.name} – ${site.name}` : company.name}?`}
                                  hiddenFields={site ? { companyId: company.id, employeeId: e.id, siteId: site.id } : { companyId: company.id, employeeId: e.id }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          });
        })}
      </Table>
      )}

      {modalCompany && (
        <CompanyModal
          company={modalCompany === "new" ? undefined : modalCompany}
          companies={companies}
          existingSiteNames={existingSiteNames}
          sitesByCompany={sitesByCompany}
          onClose={() => setModalCompany(null)}
        />
      )}

      {assignTo && (
        <AssignEmployeeModal
          companyId={assignTo.company.id}
          companyName={assignTo.site ? `${assignTo.company.name} – ${assignTo.site.name}` : assignTo.company.name}
          siteId={assignTo.site?.id}
          candidates={allEmployees.filter(
            (e) => !(companyEmployees[assignTo.company.id] ?? []).some((x) => x.id === e.id && (!assignTo.site || x.siteIds.includes(assignTo.site.id))),
          )}
          onClose={() => setAssignTo(null)}
        />
      )}
    </div>
  );
}

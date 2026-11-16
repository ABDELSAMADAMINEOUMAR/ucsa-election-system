"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";

export function AdminTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div
      className="admin-table-wrap"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="admin-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th scope="col" key={`${header}-${index}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Pagination({
  page,
  size,
  total,
  busy,
  onPage,
}: {
  page: number;
  size: number;
  total: number;
  busy?: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}`
          : "0 records"}
      </span>
      <div className="account-actions">
        <Button
          variant="secondary"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / size))}
        </span>
        <Button
          variant="secondary"
          disabled={busy || page * size >= total}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
export async function adminPost<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error ?? "The request could not be completed.");
  return body as T;
}
export type DecisionOutcome = {
  request_id: string;
  success: boolean;
  error_code: string | null;
};
const decisionErrors: Record<string, string> = {
  not_pending: "Already reviewed or unavailable",
  unmatched: "No confirmed exact roster match",
  duplicate: "Duplicate registration request — manual review required",
  conflict: "Record changed or decision could not be completed",
  conflict_or_ineligible:
    "Election rules or current identity prevent this decision",
};
export const decisionError = (value: string | null) =>
  decisionErrors[value ?? ""] ?? "Decision not completed";

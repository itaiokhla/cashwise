/**
 * @app/_lib/reportShare.ts
 *
 * Server helpers for public, token-protected report links.
 * The raw token only ever lives in the URL; the DB stores its SHA-256 hash.
 */

import DB from "@app/_database/db";
import ReportShareLink, { hashToken, type IReportShareLink } from "@app/_model/reportShareLink.model";
import { legacySection, type ReportRow, type ReportSection } from "@app/_lib/reportDigest";
import { rowsForSection } from "@app/_lib/reportExports";

export type ShareLookup =
  | { ok: true; link: IReportShareLink }
  | { ok: false; status: number; type: "INVALID_TOKEN" | "NOT_FOUND" | "REVOKED" | "EXPIRED"; message: string; expiresAt?: Date };

export async function findShareLink(token: string): Promise<ShareLookup> {
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) {
    return { ok: false, status: 400, type: "INVALID_TOKEN", message: "Invalid or malformed report link." };
  }

  await DB();
  const link = (await ReportShareLink.findOne({ tokenHash: hashToken(token) }).lean()) as IReportShareLink | null;

  if (!link) {
    return { ok: false, status: 404, type: "NOT_FOUND", message: "This report link does not exist or has already been removed." };
  }
  if (link.revokedAt) {
    return { ok: false, status: 410, type: "REVOKED", message: "This report link has been revoked by the administrator." };
  }
  if (new Date() > new Date(link.expiresAt)) {
    return { ok: false, status: 410, type: "EXPIRED", message: "This report link has expired.", expiresAt: link.expiresAt };
  }
  return { ok: true, link };
}

/** Sections with their rows attached, for both v2 and legacy snapshots. */
export function sectionsFromSnapshot(snapshot: IReportShareLink["snapshotData"]): ReportSection[] {
  const rows = (Array.isArray(snapshot.rows) ? snapshot.rows : []) as ReportRow[];
  if (Array.isArray(snapshot.sections) && snapshot.sections.length > 0) {
    return snapshot.sections.map((s) => {
      const section = s as unknown as ReportSection;
      return { ...section, rows: rowsForSection(rows, section) };
    });
  }
  return [legacySection({ ...snapshot, rows })];
}

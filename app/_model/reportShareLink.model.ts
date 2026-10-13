import mongoose, { Schema, model, models, Model, Document } from "mongoose";
import crypto from "crypto";

export interface IReportShareLink extends Document {
  reportExecutionId: mongoose.Types.ObjectId;
  scheduleId?: mongoose.Types.ObjectId | null;
  tokenHash: string; // SHA-256 of the raw token — never store raw token
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date | null;
  /**
   * Immutable copy of the report as emailed. Version 2 snapshots carry
   * `sections` (one per daily/weekly/monthly window) and a single
   * de-duplicated `rows` list; each section's rows are the rows inside its
   * from/to dates. Version 1 snapshots only have `summary` + `rows`.
   */
  snapshotData: {
    version?: number;
    reportType: string;
    fromDate: string;
    toDate: string;
    period: string;
    recordCount: number;
    totalAmount: number;
    filters: Record<string, unknown>;
    summary?: Record<string, unknown>;
    sections?: {
      key: string;
      label: string;
      from: string;
      to: string;
      rangeLabel: string;
      digest: Record<string, unknown>;
      cashPosition?: Record<string, unknown> | null;
    }[];
    rows: unknown[];
    scheduleName?: string;
    scheduleDescription?: string;
    coverage?: string;
    frequency?: string;
    generatedAt?: string;
    slotAt?: string | null;
    timezone?: string;
    recipients?: string[];
  };
}

const reportShareLinkSchema = new Schema<IReportShareLink>(
  {
    reportExecutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportExecution",
      required: true,
      index: true,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduledReport",
      default: null,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    snapshotData: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index: MongoDB auto-removes expired share links 48 h after expiry (grace window)
reportShareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 48 * 3600 });

/**
 * Generate a cryptographically secure raw token.
 * Caller stores tokenHash (SHA-256) in the DB and sends rawToken in the URL.
 */
export function generateShareToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex"); // 64-char hex
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

/** Hash an incoming raw token for DB lookup validation. */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

const ReportShareLink: Model<IReportShareLink> =
  models.ReportShareLink ||
  model<IReportShareLink>("ReportShareLink", reportShareLinkSchema);

export default ReportShareLink;

import mongoose, { Schema, model, models, Model, Document } from "mongoose";
import crypto from "crypto";

export interface IReportShareLink extends Document {
  reportExecutionId: mongoose.Types.ObjectId;
  scheduleId?: mongoose.Types.ObjectId | null;
  tokenHash: string; // SHA-256 of the raw token — never store raw token
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date | null;
  snapshotData: {
    reportType: string;
    fromDate: string;
    toDate: string;
    period: string;
    recordCount: number;
    totalAmount: number;
    filters: Record<string, unknown>;
    summary: {
      expenseTotal: number;
      creditTotal: number;
      debitTotal: number;
      grandTotal: number;
      totalRecords: number;
      averagePerEntry: number;
      byUser: Record<string, { total: number; count: number }>;
      byDate: Record<string, { total: number; count: number }>;
      byCategory: Record<string, { total: number; count: number }>;
    };
    rows: unknown[];
    scheduleName?: string;
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
      index: true,
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

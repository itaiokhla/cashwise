import mongoose, { Schema, model, models, Model, Document } from "mongoose";

export interface IScheduledReportFilters {
  userIds?: string[];
  expenseSources?: ("office" | "travel" | "toPay")[];
  categories?: string[];
  statuses?: ("pending" | "approved" | "rejected")[];
  includeCredit?: boolean;
  includeDebit?: boolean;
  visibleFields?: string[];
  search?: string;
}

export interface IScheduledReport extends Document {
  name: string;
  reportType: "expense" | "credit" | "debit" | "combined" | "office" | "travel" | "toPay" | "all";
  frequency: "daily" | "weekly" | "monthly";
  time: string; // "HH:mm" (24h)
  timezone: string;
  dayOfWeek: number;   // weekly: 1 = Monday … 7 = Sunday
  dayOfMonth: number;  // monthly: 1–31 (31 = last day of month)
  recipients: string[];
  reportPeriod: "daily" | "weekly" | "monthly" | "all";
  /** "current" = period in progress at send time, "previous" = last completed period */
  coverage: "current" | "previous";
  /** How long the emailed share link / download buttons stay valid. */
  linkTtlHours: number;
  /** Attach the PDF + Excel files to the email. */
  attachFiles: boolean;
  enabled: boolean;
  filters: IScheduledReportFilters;
  lastRunAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastSuccessSlotAt?: Date | null;
  lastFailedAt?: Date | null;
  lastErrorMessage?: string | null;
  consecutiveFailures: number;
  lockedUntil?: Date | null;
  nextRunAt?: Date | null;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledReportSchema = new Schema<IScheduledReport>(
  {
    name: {
      type: String,
      default: "Automated Report",
      trim: true,
    },
    reportType: {
      type: String,
      enum: ["expense", "credit", "debit", "combined", "office", "travel", "toPay", "all"],
      default: "expense",
      required: true,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "daily",
      required: true,
    },
    time: {
      type: String,
      default: "09:00",
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm format (24-hour)"],
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
      required: true,
    },
    dayOfWeek: { type: Number, default: 1, min: 1, max: 7 },
    dayOfMonth: { type: Number, default: 1, min: 1, max: 31 },
    // Existing schedules keep the original "previous period" behaviour.
    coverage: { type: String, enum: ["current", "previous"], default: "previous" },
    linkTtlHours: { type: Number, default: 168, min: 1, max: 24 * 31 },
    attachFiles: { type: Boolean, default: true },
    recipients: {
      type: [String],
      required: true,
      validate: {
        validator: (emails: string[]) =>
          emails.length > 0 && emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
        message: "At least one valid recipient email is required",
      },
    },
    reportPeriod: {
      type: String,
      enum: ["daily", "weekly", "monthly", "all"],
      default: "all",
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    filters: {
      type: {
        userIds: { type: [String], default: [] },
        expenseSources: {
          type: [String],
          enum: ["office", "travel", "toPay"],
          default: [],
        },
        categories: { type: [String], default: [] },
        statuses: {
          type: [String],
          enum: ["pending", "approved", "rejected"],
          default: [],
        },
        includeCredit: { type: Boolean, default: true },
        includeDebit: { type: Boolean, default: true },
        visibleFields: { type: [String], default: [] },
        search: { type: String, default: "" },
      },
      default: () => ({
        userIds: [],
        expenseSources: [],
        categories: [],
        statuses: [],
        includeCredit: true,
        includeDebit: true,
        visibleFields: [],
        search: "",
      }),
    },
    lastRunAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastSuccessSlotAt: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
    lastErrorMessage: { type: String, default: null },
    consecutiveFailures: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    nextRunAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  },
  { timestamps: true }
);

const ScheduledReport: Model<IScheduledReport> =
  models.ScheduledReport || model<IScheduledReport>("ScheduledReport", scheduledReportSchema);

export default ScheduledReport;

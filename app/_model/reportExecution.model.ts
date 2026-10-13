import mongoose, { Schema, model, models, Model, Document } from "mongoose";

export interface IReportExecution extends Document {
  scheduleId?: mongoose.Types.ObjectId | null;
  executionKey: string;
  reportType: string;
  period: string;
  fromDate: string;
  toDate: string;
  recipients: string[];
  recipientCount: number;
  recordCount: number;
  totalAmount: number;
  status: "success" | "failed";
  errorMessage?: string | null;
  pdfUrls: string[];
  shareLinkId?: mongoose.Types.ObjectId | null; // link to ReportShareLink document
  shareUrl?: string | null;                      // fully formed public share URL
  shareExpiresAt?: Date | null;                 // copy of share link expiry for quick reference
  slotAt?: Date | null;                         // scheduled time this run delivered (null for manual)
  sections?: { key: string; label: string; from: string; to: string; total: number; count: number }[];
  emailMessageId?: string | null;
  durationMs: number;
  executedAt: Date;
  triggeredBy: "cron" | "manual_test" | "scheduler" | "manual_generate";
  createdAt: Date;
  updatedAt: Date;
}

const reportExecutionSchema = new Schema<IReportExecution>(
  {
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduledReport",
      default: null,
      index: true,
    },
    executionKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reportType: { type: String, default: "expense" },
    period: { type: String, required: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    recipients: { type: [String], required: true, default: [] },
    recipientCount: { type: Number, default: 0 },
    recordCount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
      index: true,
    },
    errorMessage: { type: String, default: null },
    pdfUrls: { type: [String], default: [] },
    shareLinkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportShareLink",
      default: null,
      index: true,
    },
    shareUrl: { type: String, default: null },
    shareExpiresAt: { type: Date, default: null },
    slotAt: { type: Date, default: null },
    sections: {
      type: [
        {
          _id: false,
          key: String,
          label: String,
          from: String,
          to: String,
          total: Number,
          count: Number,
        },
      ],
      default: [],
    },
    emailMessageId: { type: String, default: null },
    durationMs: { type: Number, default: 0 },
    executedAt: { type: Date, default: Date.now, index: true },
    triggeredBy: {
      type: String,
      enum: ["cron", "manual_test", "scheduler", "manual_generate"],
      default: "cron",
    },
  },
  { timestamps: true }
);

const ReportExecution: Model<IReportExecution> =
  models.ReportExecution || model<IReportExecution>("ReportExecution", reportExecutionSchema);

export default ReportExecution;

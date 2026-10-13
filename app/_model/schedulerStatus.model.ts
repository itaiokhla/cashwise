import { Schema, model, models, Model } from "mongoose";

/**
 * Single-document heartbeat written every time the report scheduler endpoint
 * is triggered. The Settings page reads it to show whether the cron is
 * actually reaching the deployment (and from where).
 */
export interface ISchedulerStatus {
  _id: string;
  lastTickAt: Date | null;
  lastTickSource: string;
  lastTickSummary: {
    due: number;
    sent: number;
    failed: number;
    skipped: number;
    durationMs: number;
  };
  lastSentAt: Date | null;
  tickCount: number;
}

export const SCHEDULER_STATUS_ID = "report-scheduler";

const schedulerStatusSchema = new Schema<ISchedulerStatus>(
  {
    _id: { type: String, default: SCHEDULER_STATUS_ID },
    lastTickAt: { type: Date, default: null },
    lastTickSource: { type: String, default: "" },
    lastTickSummary: {
      due: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
    lastSentAt: { type: Date, default: null },
    tickCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const SchedulerStatus: Model<ISchedulerStatus> =
  models.SchedulerStatus || model<ISchedulerStatus>("SchedulerStatus", schedulerStatusSchema);

export default SchedulerStatus;

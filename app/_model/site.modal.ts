import { SiteInterface } from "@app/_interface/site.interface";
import { Schema, model, models, Model } from "mongoose";

const siteSchema = new Schema<SiteInterface>(
  {
    name: {
      type: String,
      required: [true, "Site Name is required!"],
    },
    address: {
      type: String,
    },
    status: {
      type: String,
      default: "active",
    },
    createdBy: {
      type: String,
      default: "admin",
    },
  },
  { timestamps: true }
);

const Site: Model<SiteInterface> =
  models.Site || model<SiteInterface>("Site", siteSchema);

export default Site;

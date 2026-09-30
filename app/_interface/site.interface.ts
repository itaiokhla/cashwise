import mongoose from "mongoose"

export interface SiteInterface {
    _id: mongoose.Schema.Types.ObjectId | null,
    name: string,
    address: string,
    createdBy: string,
    status:string,
}
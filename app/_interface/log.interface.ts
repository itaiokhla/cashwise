import mongoose from "mongoose";

export interface ILog {
    _id: mongoose.Schema.Types.ObjectId,
    errorName: string,
    errorDescription: string,
    code: mongoose.Schema.Types.ObjectId[],
    createAt: Date,
    other: string
}
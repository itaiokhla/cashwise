import mongoose from "mongoose"

export interface IUsers {
    _id: mongoose.Schema.Types.ObjectId | null,
    name: string,
    email: string,
    password: string,
    createdAt: Date| null,
    updatedAt: Date | null,
    createdBy: mongoose.Schema.Types.ObjectId | null,
    role: string,
    phone:number | null,
    type: string
}
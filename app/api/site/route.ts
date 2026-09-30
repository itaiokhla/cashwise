'use server';
import DB from "@app/_database/db";
import HandleResponse from "@app/_helpers/Handler";
import Site from "@app/_model/site.modal";
import { NextRequest,NextResponse } from "next/server";
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types; 

// Initialize database connection
(async function initializeDB() {
    await DB();
  })();
  
  export async function POST(req: NextRequest) {
    try {
      const {_id,name,address,status } = await req.json();
     if(!_id){
        const newsite = new Site({
          name, address, status
        });
        await newsite.save();
        return NextResponse.json(
            { type: "SUCCESS",
                message: "Site Created Successfully!" },
            { status: 201 }
            );
     }
     else{
        const site = await Site.findOneAndUpdate(
            { _id: new ObjectId(_id) },
            { name, address, status },
            { new: true } 
          );     
            return NextResponse.json(
            { type: "SUCCESS",
                message: "Site Updated Successfully!" },
            { status: 200 }
            );
     }
      }
     catch (error: any) {
        // Return an error response
        return NextResponse.json({
            type: "ERROR",
            message: "Something went wrong!"
        }, { status: 500 });
      }
    }
// function to get all site
export async function GET(req: NextRequest) {
    try {
        const sites = await Site.find().sort({ status: 1 });
        if (!sites) {
            return NextResponse.json({
                type: "BAD_REQUEST",
                message: "Site not found",
            }, { status: 404 });
        }
       
return NextResponse.json(sites, { status: 200 });
    } catch (error) {
        // Return an error response
        return NextResponse.json({
            type: "ERROR",
            message: "Something went wrong!"
        }, { status: 500 });
    }
}
'use server';
import DB from "@app/_database/db";
import HandleResponse from "@app/_helpers/Handler";
import Site from "@app/_model/site.modal";
import { NextRequest,NextResponse } from "next/server";

// Initialize database connection
(async function initializeDB() {
    await DB();
  })();
  
  export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
const siteName= searchParams.get('siteName');
try{
    const sites = await Site.find({
        name: { $regex: siteName, $options: 'i' }, 
        status: 'active' 
    }).sort({ updatedAt: -1 });
   
    return NextResponse.json(sites, { status: 200 });
}
catch (error: any) {
   // Return an error response
   return NextResponse.json({
       type: "ERROR",
       message: "Something went wrong!"
   }, { status: 500 });
 }
  }

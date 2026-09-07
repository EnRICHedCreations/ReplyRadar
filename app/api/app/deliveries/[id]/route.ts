import { NextResponse } from "next/server";
const removed=()=>NextResponse.json({error:"External notification deliveries were removed. Use in-app notifications."},{status:410});
export const GET=removed; export const POST=removed;

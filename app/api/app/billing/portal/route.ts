import { NextResponse } from "next/server";
const removed=()=>NextResponse.json({error:"Subscriptions were removed. ReplyRadar now uses prepaid usage credits."},{status:410});
export const GET=removed; export const POST=removed;

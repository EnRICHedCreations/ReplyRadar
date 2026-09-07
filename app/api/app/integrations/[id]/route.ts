import { NextResponse } from "next/server";
const removed=()=>NextResponse.json({error:"External integrations were removed. Use ReplyRadar's in-app notifications."},{status:410});
export const GET=removed; export const POST=removed; export const DELETE=removed;

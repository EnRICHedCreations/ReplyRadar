import { NextResponse } from "next/server";
const removed=()=>NextResponse.json({error:"Subscriptions were removed. Buy prepaid usage credits from /billing."},{status:410});
export const GET=removed; export const POST=removed;

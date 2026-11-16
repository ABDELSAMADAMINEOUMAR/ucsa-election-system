import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json(
    { status: "ok", scope: "management-and-fictional-demonstration", realVotingEnabled: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}

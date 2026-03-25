import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const scrapeResult = await fetch(`${baseUrl}/api/scrape`);
    const scrapeData = await scrapeResult.json();

    return NextResponse.json({
      success: true,
      scrapeResult: {
        parsed: scrapeData.parsed || 0,
        timestamp: scrapeData.timestamp,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

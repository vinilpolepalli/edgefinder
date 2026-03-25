import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/data-pipeline";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") || "basketball_nba";
  const minOdds = parseInt(searchParams.get("minOdds") || "-300");
  const maxOdds = parseInt(searchParams.get("maxOdds") || "-500");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002";

  try {
    const result = await runPipeline(baseUrl, sport, minOdds, maxOdds);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Pipeline error:", error);
    return NextResponse.json({
      props: [],
      meta: {
        rawCount: 0,
        enrichedCount: 0,
        sport,
        oddsRange: { min: minOdds, max: maxOdds },
        timestamp: new Date().toISOString(),
        usingDemo: true,
        error: String(error),
      },
    });
  }
}

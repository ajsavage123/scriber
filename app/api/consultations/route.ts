import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("consultations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ consultations: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseServer
      .from("consultations")
      .insert([body])
      .select()
      .single();

    if (error) {
      const isInvalidApiKey = error.message.toLowerCase().includes("invalid api key");
      return NextResponse.json(
        {
          error: isInvalidApiKey
            ? "Supabase API credentials are invalid. Update .env with the current project keys and restart the server."
            : error.message,
        },
        { status: isInvalidApiKey ? 503 : 500 },
      );
    }
    return NextResponse.json({ consultation: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
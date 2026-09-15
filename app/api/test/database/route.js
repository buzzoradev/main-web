import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();
    
    // Harmless read query to verify database connectivity
    const { data, error } = await supabase.from("orders").select("id").limit(1);

    if (error) {
      console.error("[Database Connection Error]:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { error: "Database connection failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Database Connection Error]:", err?.message || err);
    return NextResponse.json(
      { error: "Database connection failed." },
      { status: 500 }
    );
  }
}

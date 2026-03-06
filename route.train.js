// app/api/train/route.js
// Next.js API route — triggers chatbot training pipeline

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { trainChatbot } from "@/lib/train";
import { pool } from "@/lib/db";

export async function POST(req) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatbotId } = await req.json();

  if (!chatbotId) {
    return NextResponse.json({ error: "chatbotId is required" }, { status: 400 });
  }

  // Verify chatbot belongs to this user
  const result = await pool.query(
    "SELECT * FROM chatbots WHERE id = $1 AND user_id = $2",
    [chatbotId, userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
  }

  const chatbot = result.rows[0];

  // Run training in background (don't await — return immediately)
  trainChatbot(chatbotId, chatbot.website_url).catch((err) => {
    console.error("Background training error:", err);
  });

  return NextResponse.json({
    success: true,
    message: "Training started",
    chatbotId,
  });
}

// GET — check training status
export async function GET(req) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const chatbotId = searchParams.get("chatbotId");

  const result = await pool.query(
    "SELECT id, status, training_progress FROM chatbots WHERE id = $1 AND user_id = $2",
    [chatbotId, userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

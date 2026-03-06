// app/api/chat/history/route.js
// Fetch message history for a chat session

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const chatbotId = searchParams.get("chatbotId");

  if (!sessionId || !chatbotId) {
    return NextResponse.json({ error: "sessionId and chatbotId required" }, { status: 400 });
  }

  // Verify session belongs to this chatbot
  const sessionRes = await pool.query(
    "SELECT id FROM chat_sessions WHERE id = $1 AND chatbot_id = $2",
    [sessionId, chatbotId]
  );

  if (sessionRes.rows.length === 0) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fetch messages
  const messagesRes = await pool.query(
    `SELECT role, content, created_at
     FROM messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );

  return NextResponse.json({ messages: messagesRes.rows });
}

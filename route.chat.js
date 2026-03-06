// app/api/chat/route.js
// Streaming chat endpoint — used by the embeddable widget

import { NextResponse } from "next/server";
import { streamAnswer } from "@/lib/claude";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req) {
  const { chatbotId, message, sessionId, history = [] } = await req.json();

  // Validate inputs
  if (!chatbotId || !message) {
    return NextResponse.json({ error: "chatbotId and message are required" }, { status: 400 });
  }

  // Fetch chatbot config + verify it exists and is active
  const botResult = await pool.query(
    "SELECT * FROM chatbots WHERE id = $1 AND status = 'active'",
    [chatbotId]
  );

  if (botResult.rows.length === 0) {
    return NextResponse.json({ error: "Chatbot not found or not ready" }, { status: 404 });
  }

  const chatbot = botResult.rows[0];

  // Check message limits for subscription
  const limitOk = await checkMessageLimit(chatbot.user_id);
  if (!limitOk) {
    return NextResponse.json(
      { error: "Monthly message limit reached. Please upgrade your plan." },
      { status: 429 }
    );
  }

  // Save user message to DB
  const session = await getOrCreateSession(chatbotId, sessionId);
  await saveMessage(session.id, "user", message);

  // Stream Claude's response
  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamAnswer(
          chatbotId,
          message,
          history,
          chatbot.system_prompt,
          (token) => {
            fullResponse += token;
            // Send token as SSE (Server-Sent Events)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
          }
        );

        // Save assistant response to DB
        await saveMessage(session.id, "assistant", fullResponse);

        // Increment message usage
        await incrementMessageUsage(chatbot.user_id);

        // Signal stream end
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId: session.id })}\n\n`));
        controller.close();

      } catch (err) {
        console.error("Chat stream error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*", // Allow widget from any domain
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────────

async function getOrCreateSession(chatbotId, sessionId) {
  if (sessionId) {
    const res = await pool.query(
      "SELECT * FROM chat_sessions WHERE id = $1 AND chatbot_id = $2",
      [sessionId, chatbotId]
    );
    if (res.rows.length > 0) return res.rows[0];
  }

  const res = await pool.query(
    `INSERT INTO chat_sessions (id, chatbot_id, visitor_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING *`,
    [chatbotId, crypto.randomUUID()]
  );
  return res.rows[0];
}

async function saveMessage(sessionId, role, content) {
  await pool.query(
    `INSERT INTO messages (id, session_id, role, content, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
    [sessionId, role, content]
  );
}

async function checkMessageLimit(userId) {
  const res = await pool.query(
    "SELECT message_limit, messages_used FROM subscriptions WHERE user_id = $1",
    [userId]
  );
  if (res.rows.length === 0) return false;
  const { message_limit, messages_used } = res.rows[0];
  return messages_used < message_limit;
}

async function incrementMessageUsage(userId) {
  await pool.query(
    "UPDATE subscriptions SET messages_used = messages_used + 1 WHERE user_id = $1",
    [userId]
  );
}

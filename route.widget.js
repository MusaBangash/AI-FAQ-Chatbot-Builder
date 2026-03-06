// app/api/widget/route.js
// Serves the widget.js file with dynamic chatbot config baked in

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chatbotId = searchParams.get("id");

  if (!chatbotId) {
    return new Response("Missing chatbot id", { status: 400 });
  }

  // Fetch chatbot settings
  const result = await pool.query(
    "SELECT name, color, system_prompt, status FROM chatbots WHERE id = $1",
    [chatbotId]
  );

  if (result.rows.length === 0) {
    return new Response("Chatbot not found", { status: 404 });
  }

  const bot = result.rows[0];

  if (bot.status !== "active") {
    return new Response("// Chatbot is not active yet", {
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Read base widget file
  const widgetPath = join(process.cwd(), "public", "widget.js");
  let widgetCode = readFileSync(widgetPath, "utf-8");

  // Inject chatbot config at the top
  const configInjection = `
window.chatbotId = "${chatbotId}";
window.chatbaseConfig = {
  color: "${bot.color || "#6EE7B7"}",
  title: "${bot.name.replace(/"/g, '\\"')}",
  welcomeMessage: "Hi! I'm ${bot.name.replace(/"/g, '\\"')}. How can I help you today? 👋",
};
`;

  widgetCode = configInjection + "\n" + widgetCode;

  return new Response(widgetCode, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300", // Cache 5 mins
      "Access-Control-Allow-Origin": "*",
    },
  });
}

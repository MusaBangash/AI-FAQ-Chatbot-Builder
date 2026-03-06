// lib/claude.js
// Claude-powered Q&A using RAG (Retrieval Augmented Generation)

const Anthropic = require("@anthropic-ai/sdk");
const { searchSimilarChunks } = require("./embeddings");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Answer a user question using relevant chunks from the knowledge base
 * @param {string} chatbotId
 * @param {string} question - User's message
 * @param {Array} history - Previous messages [{role, content}]
 * @param {string} systemPrompt - Custom system prompt from chatbot settings
 * @returns {string} - Claude's answer
 */
async function answerQuestion(chatbotId, question, history = [], systemPrompt = "") {
  // Step 1 — Find relevant chunks from vector DB
  const chunks = await searchSimilarChunks(chatbotId, question, 5);

  if (chunks.length === 0) {
    return "I'm sorry, I don't have enough information to answer that question. Please contact our support team for help.";
  }

  // Step 2 — Build context from chunks
  const context = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.source_title || c.source_url}]\n${c.content}`)
    .join("\n\n---\n\n");

  // Step 3 — Build system prompt
  const system = buildSystemPrompt(context, systemPrompt);

  // Step 4 — Build message history (last 10 messages max)
  const recentHistory = history.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Step 5 — Call Claude
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system,
    messages: [
      ...recentHistory,
      { role: "user", content: question },
    ],
  });

  return response.content[0].text;
}

/**
 * Stream Claude's response token by token
 * @param {string} chatbotId
 * @param {string} question
 * @param {Array} history
 * @param {string} systemPrompt
 * @param {function} onToken - Callback for each token
 */
async function streamAnswer(chatbotId, question, history = [], systemPrompt = "", onToken) {
  const chunks = await searchSimilarChunks(chatbotId, question, 5);

  const context = chunks.length > 0
    ? chunks.map((c, i) => `[Source ${i + 1}: ${c.source_title || c.source_url}]\n${c.content}`).join("\n\n---\n\n")
    : "No relevant content found.";

  const system = buildSystemPrompt(context, systemPrompt);
  const recentHistory = history.slice(-10);

  const stream = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    stream: true,
    system,
    messages: [
      ...recentHistory,
      { role: "user", content: question },
    ],
  });

  let fullText = "";

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const token = event.delta.text;
      fullText += token;
      onToken(token);
    }
  }

  return fullText;
}

/**
 * Build the system prompt with injected context
 */
function buildSystemPrompt(context, customPrompt) {
  const base = customPrompt ||
    "You are a helpful customer support assistant. Answer questions accurately and concisely.";

  return `${base}

IMPORTANT RULES:
- Answer ONLY based on the context provided below
- If the answer is not in the context, say: "I don't have information about that. Please contact our support team."
- Be concise and friendly
- Never make up information
- If asked something off-topic, politely redirect to relevant topics

KNOWLEDGE BASE CONTEXT:
${context}`;
}

module.exports = { answerQuestion, streamAnswer };

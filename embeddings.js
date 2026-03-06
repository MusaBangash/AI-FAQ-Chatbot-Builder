// lib/embeddings.js
// Generates embeddings via OpenAI and stores them in pgvector (Postgres)

const { Pool } = require("pg");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMBEDDING_MODEL = "text-embedding-3-small"; // Cheap & accurate
const BATCH_SIZE = 50; // Max embeddings per API call

/**
 * Generate embedding for a single text string
 * @param {string} text
 * @returns {number[]} - 1536-dimensional vector
 */
async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // Max token limit
  });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batches
 * @param {string[]} texts
 * @returns {number[][]}
 */
async function generateEmbeddingsBatch(texts) {
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(`🔢 Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((t) => t.slice(0, 8000)),
    });

    const embeddings = response.data.map((d) => d.embedding);
    allEmbeddings.push(...embeddings);

    // Small delay to avoid rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}

/**
 * Store chunks + embeddings in pgvector DB
 * @param {string} chatbotId
 * @param {Array<{content, sourceUrl, sourceTitle}>} chunks
 */
async function storeEmbeddings(chatbotId, chunks) {
  const client = await pool.connect();

  try {
    // Delete old chunks for this chatbot (re-training)
    await client.query(
      "DELETE FROM knowledge_chunks WHERE chatbot_id = $1",
      [chatbotId]
    );

    // Generate all embeddings in batches
    const texts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    // Insert all chunks with embeddings
    await client.query("BEGIN");

    for (let i = 0; i < chunks.length; i++) {
      const { content, sourceUrl, sourceTitle } = chunks[i];
      const embedding = embeddings[i];

      await client.query(
        `INSERT INTO knowledge_chunks 
         (id, chatbot_id, content, embedding, source_url, source_title, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [
          chatbotId,
          content,
          `[${embedding.join(",")}]`, // pgvector format
          sourceUrl,
          sourceTitle,
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`✅ Stored ${chunks.length} chunks for chatbot ${chatbotId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Search for most relevant chunks for a query
 * @param {string} chatbotId
 * @param {string} query - User's question
 * @param {number} topK - Number of results to return (default: 5)
 * @returns {Array<{content, sourceUrl, similarity}>}
 */
async function searchSimilarChunks(chatbotId, query, topK = 5) {
  const queryEmbedding = await generateEmbedding(query);

  const result = await pool.query(
    `SELECT 
       content,
       source_url,
       source_title,
       1 - (embedding <=> $1::vector) AS similarity
     FROM knowledge_chunks
     WHERE chatbot_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [`[${queryEmbedding.join(",")}]`, chatbotId, topK]
  );

  return result.rows.filter((r) => r.similarity > 0.5); // Filter low relevance
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
  storeEmbeddings,
  searchSimilarChunks,
};

// lib/train.js
// Main training pipeline - orchestrates scraping, chunking, and embedding

const { scrapeWebsite } = require("./scraper");
const { chunkPages } = require("./chunker");
const { storeEmbeddings } = require("./embeddings");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Full training pipeline for a chatbot
 * @param {string} chatbotId
 * @param {string} websiteUrl
 * @param {function} onProgress - Optional progress callback
 */
async function trainChatbot(chatbotId, websiteUrl, onProgress = () => {}) {
  try {
    // Step 1 - Update status to training
    await updateChatbotStatus(chatbotId, "training", 0);
    onProgress({ step: "scraping", progress: 0, message: "Starting website scrape..." });

    // Step 2 - Scrape website
    console.log(`\n🚀 Training chatbot ${chatbotId} on ${websiteUrl}`);
    const pages = await scrapeWebsite(websiteUrl, 20);

    if (pages.length === 0) {
      throw new Error("No content found at the provided URL");
    }

    onProgress({ step: "scraping", progress: 30, message: `Scraped ${pages.length} pages` });
    await updateChatbotStatus(chatbotId, "training", 30);

    // Step 3 - Chunk text
    onProgress({ step: "chunking", progress: 40, message: "Processing content..." });
    const chunks = chunkPages(pages, 500, 50);

    if (chunks.length === 0) {
      throw new Error("No text content could be extracted");
    }

    onProgress({ step: "chunking", progress: 50, message: `Created ${chunks.length} knowledge chunks` });

    // Step 4 - Generate embeddings + store
    onProgress({ step: "embedding", progress: 55, message: "Generating AI embeddings..." });
    await storeEmbeddings(chatbotId, chunks);

    onProgress({ step: "complete", progress: 100, message: "Training complete!" });
    await updateChatbotStatus(chatbotId, "active", 100);

    console.log(`\n✅ Training complete for chatbot ${chatbotId}`);
    return { success: true, pages: pages.length, chunks: chunks.length };

  } catch (err) {
    console.error(`❌ Training failed for ${chatbotId}:`, err.message);
    await updateChatbotStatus(chatbotId, "failed", 0);
    throw err;
  }
}

/**
 * Update chatbot training status in DB
 */
async function updateChatbotStatus(chatbotId, status, progress) {
  await pool.query(
    `UPDATE chatbots 
     SET status = $1, training_progress = $2, updated_at = NOW()
     WHERE id = $3`,
    [status, progress, chatbotId]
  );
}

module.exports = { trainChatbot };

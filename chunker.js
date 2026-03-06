// lib/chunker.js
// Splits long text into smaller chunks suitable for embeddings

/**
 * Split scraped pages into chunks
 * @param {Array<{url, title, content}>} pages
 * @param {number} chunkSize - Max characters per chunk (default: 500)
 * @param {number} overlap - Overlap between chunks (default: 50)
 * @returns {Array<{content, sourceUrl, sourceTitle}>}
 */
function chunkPages(pages, chunkSize = 500, overlap = 50) {
  const allChunks = [];

  for (const page of pages) {
    const chunks = chunkText(page.content, chunkSize, overlap);
    for (const chunk of chunks) {
      allChunks.push({
        content: chunk,
        sourceUrl: page.url,
        sourceTitle: page.title,
      });
    }
  }

  console.log(`📦 Created ${allChunks.length} chunks from ${pages.length} pages`);
  return allChunks;
}

/**
 * Split a single text string into overlapping chunks
 */
function chunkText(text, chunkSize = 500, overlap = 50) {
  if (!text || text.length === 0) return [];

  // Split into sentences first for cleaner chunks
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    // If adding this sentence exceeds chunk size, save current chunk
    if (current.length + sentence.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());

      // Start next chunk with overlap from end of current
      const words = current.split(" ");
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      current = overlapWords.join(" ") + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }

  // Push remaining text
  if (current.trim().length > 50) {
    chunks.push(current.trim());
  }

  return chunks;
}

module.exports = { chunkPages, chunkText };

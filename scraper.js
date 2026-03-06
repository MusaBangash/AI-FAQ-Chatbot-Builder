// lib/scraper.js
// Scrapes a website and extracts clean text content

const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");

/**
 * Scrape all pages from a website starting from the root URL
 * @param {string} startUrl - The root URL to start scraping
 * @param {number} maxPages - Maximum pages to scrape (default: 20)
 * @returns {Array<{url, title, content}>}
 */
async function scrapeWebsite(startUrl, maxPages = 20) {
  const visited = new Set();
  const queue = [startUrl];
  const results = [];
  const base = new URL(startUrl).origin;

  console.log(`🔍 Starting scrape: ${startUrl}`);

  while (queue.length > 0 && results.length < maxPages) {
    const url = queue.shift();

    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const { title, content, links } = await scrapePage(url);

      if (content.length > 100) {
        results.push({ url, title, content });
        console.log(`✅ Scraped: ${url} (${content.length} chars)`);
      }

      // Add internal links to queue
      for (const link of links) {
        const absolute = resolveUrl(base, link);
        if (absolute && absolute.startsWith(base) && !visited.has(absolute)) {
          queue.push(absolute);
        }
      }

      // Polite delay between requests
      await sleep(300);
    } catch (err) {
      console.warn(`⚠️ Failed to scrape ${url}: ${err.message}`);
    }
  }

  console.log(`✅ Scraping complete: ${results.length} pages`);
  return results;
}

/**
 * Scrape a single page
 */
async function scrapePage(url) {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ChatbaseBot/1.0)",
    },
  });

  const $ = cheerio.load(response.data);

  // Remove noisy elements
  $("script, style, nav, footer, header, iframe, noscript, svg, [aria-hidden='true']").remove();
  $(".cookie-banner, .popup, .modal, .ad, .advertisement").remove();

  const title = $("title").text().trim() || $("h1").first().text().trim();

  // Extract clean text
  const content = $("body")
    .text()
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim();

  // Extract internal links
  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      links.push(href);
    }
  });

  return { title, content, links };
}

/**
 * Resolve relative URLs to absolute
 */
function resolveUrl(base, href) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { scrapeWebsite, scrapePage };

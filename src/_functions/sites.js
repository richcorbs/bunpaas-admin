import { getSites, createSite } from "./lib/sites.js";

const DATA_DIR = "/var/www";

/**
 * GET /sites - List all sites
 */
export async function get(req) {
  // Verify API key
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  try {
    const sites = await getSites(DATA_DIR);
    return { status: 200, body: sites };
  } catch (err) {
    console.error("Error listing sites:", err);
    return { status: 500, body: { error: "Failed to list sites" } };
  }
}

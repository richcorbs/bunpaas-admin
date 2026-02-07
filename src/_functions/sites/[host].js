import {
  getSiteByHost,
  createSite,
  updateSite,
  deleteSite,
} from "../lib/sites.js";

const DATA_DIR = "/var/www";

/**
 * GET /sites/:host - Get a single site
 */
export async function get(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { host } = req.params;

  try {
    const site = await getSiteByHost(DATA_DIR, host);
    if (!site) {
      return { status: 404, body: { error: "Site not found" } };
    }
    return { status: 200, body: { host, ...site } };
  } catch (err) {
    console.error("Error getting site:", err);
    return { status: 500, body: { error: "Failed to get site" } };
  }
}

/**
 * PUT /sites/:host - Create or update a site
 */
export async function put(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { host } = req.params;
  const updates = req.body || {};

  try {
    const existing = await getSiteByHost(DATA_DIR, host);

    if (existing) {
      // Update existing site
      const updated = await updateSite(DATA_DIR, host, updates);
      return { status: 200, body: { host, ...updated } };
    } else {
      // Create new site
      const created = await createSite(DATA_DIR, host, updates);
      return { status: 201, body: created };
    }
  } catch (err) {
    console.error("Error creating/updating site:", err);
    return { status: 500, body: { error: err.message } };
  }
}

/**
 * DELETE /sites/:host - Delete a site
 */
export async function del(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { host } = req.params;

  try {
    await deleteSite(DATA_DIR, host);
    return { status: 200, body: { deleted: true, host } };
  } catch (err) {
    console.error("Error deleting site:", err);
    return { status: 500, body: { error: err.message } };
  }
}

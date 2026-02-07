import { getSiteEnv, updateSiteEnv } from "../../lib/sites.js";

const DATA_DIR = "/var/www";

/**
 * GET /sites/:host/env - Get site environment variables
 */
export async function get(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { host } = req.params;

  try {
    const env = await getSiteEnv(DATA_DIR, host);
    return { status: 200, body: env };
  } catch (err) {
    console.error("Error getting env:", err);
    return { status: 500, body: { error: err.message } };
  }
}

/**
 * PUT /sites/:host/env - Update site environment variables
 */
export async function put(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { host } = req.params;
  const env = req.body || {};

  try {
    const updated = await updateSiteEnv(DATA_DIR, host, env);
    return { status: 200, body: updated };
  } catch (err) {
    console.error("Error updating env:", err);
    return { status: 500, body: { error: err.message } };
  }
}

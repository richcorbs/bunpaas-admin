import { promises as fs } from "fs";
import path from "path";
import { clearFunctionCache } from "../../lib/functions.js";

const DATA_DIR = "/var/www";

/**
 * POST /sites/:host/rollback - Rollback to a previous deploy
 */
export async function post(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { host } = req.params;
  const { deploy } = req.body || {};

  if (!deploy) {
    return { status: 400, body: { error: "deploy timestamp required" } };
  }

  const siteDir = path.join(DATA_DIR, "sites", host);
  const deploysDir = path.join(siteDir, "deploys");
  const targetDir = path.join(deploysDir, deploy);
  const currentLink = path.join(siteDir, "current");

  try {
    // Verify deploy exists
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      return { status: 404, body: { error: "Deploy not found" } };
    }

    // Update symlink
    await fs.rm(currentLink, { force: true });
    await fs.symlink(`./deploys/${deploy}`, currentLink);

    // Clear function cache
    clearFunctionCache(host);

    return {
      status: 200,
      body: { success: true, host, deploy },
    };
  } catch (err) {
    console.error("Rollback error:", err);
    return { status: 500, body: { error: err.message } };
  }
}

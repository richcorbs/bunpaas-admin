import { promises as fs } from "fs";
import path from "path";
import { getSiteByHost } from "../../lib/sites.js";

const DATA_DIR = "/var/www";

/**
 * GET /sites/:host/deploys - List deploys for a site
 */
export async function get(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { host } = req.params;

  try {
    // Get site config with deploy history
    const site = await getSiteByHost(DATA_DIR, host);
    if (!site) {
      return { status: 404, body: { error: "Site not found" } };
    }

    const siteDir = path.join(DATA_DIR, "sites", host);
    const deploysDir = path.join(siteDir, "_deploys");
    const currentLink = path.join(siteDir, "current");

    // Get current deploy target
    let currentDeploy = null;
    try {
      const linkTarget = await fs.readlink(currentLink);
      currentDeploy = path.basename(linkTarget);
    } catch {
      // No current symlink
    }

    // Get available deploys on disk (for rollback)
    let availableOnDisk = new Set();
    try {
      const entries = await fs.readdir(deploysDir, { withFileTypes: true });
      entries.filter((e) => e.isDirectory()).forEach((e) => availableOnDisk.add(e.name));
    } catch {
      // No deploys directory
    }

    // Build deploy list from history, marking which are available for rollback
    const deployHistory = site.deployHistory || [];
    const deploys = deployHistory.map((entry) => {
      // Handle both old format (string) and new format (object)
      const timestamp = typeof entry === "string" ? entry : entry.timestamp;
      const files = typeof entry === "object" ? entry.files : null;
      const size = typeof entry === "object" ? entry.size : null;
      // Convert ISO timestamp to directory format for comparison
      const dirFormat = timestamp.replace(/[-:T]/g, "").slice(0, 14);
      return {
        timestamp,
        files,
        size,
        current: dirFormat === currentDeploy,
        canRollback: availableOnDisk.has(dirFormat),
      };
    });

    return { status: 200, body: deploys };
  } catch (err) {
    console.error("Error listing deploys:", err);
    return { status: 500, body: { error: err.message } };
  }
}

import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { getSiteByHost, updateSite } from "./lib/sites.js";
import { clearFunctionCache } from "./lib/functions.js";

const execAsync = promisify(exec);
const DATA_DIR = "/var/www";
const MAX_DEPLOYS = 4;      // Directories kept on disk (extra buffer for cached server)
const MAX_HISTORY = 10;     // Timestamps kept in sites.json

/**
 * POST /deploy - Receive and extract a deploy tarball
 * Headers:
 *   X-Deploy-Key: The site's deploy key
 *   X-Target-Host: The target site hostname
 * Body: tarball file (multipart/form-data or raw)
 */
export async function post(req) {
  const deployKey = req.headers["x-deploy-key"];
  let targetHost = req.headers["x-target-host"];

  if (!deployKey || !targetHost) {
    return {
      status: 400,
      body: { error: "X-Deploy-Key and X-Target-Host headers required" },
    };
  }

  // Map .localhost to .richcorbs.com for dev deployments
  if (targetHost.endsWith(".localhost")) {
    targetHost = targetHost.replace(".localhost", ".richcorbs.com");
  }

  // Verify site exists and deploy key matches
  const site = await getSiteByHost(DATA_DIR, targetHost);
  if (!site) {
    return { status: 404, body: { error: "Site not found" } };
  }

  if (site.deployKey !== deployKey) {
    return { status: 401, body: { error: "Invalid deploy key" } };
  }

  // Create timestamp for this deploy (used for both directory and history)
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const isoTimestamp = now.toISOString();

  const siteDir = path.join(DATA_DIR, "sites", targetHost);
  const deploysDir = path.join(siteDir, "_deploys");
  const newDeployDir = path.join(deploysDir, timestamp);
  const currentLink = path.join(siteDir, "current");
  const tempDir = path.join(DATA_DIR, "tmp", `deploy-${timestamp}`);

  try {
    // Create directories
    await fs.mkdir(deploysDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });

    // The body should be the tarball data
    // In a real implementation, this would handle multipart/form-data
    // For now, assume raw tarball body
    const tarballPath = path.join(tempDir, "deploy.tar.gz");

    if (Buffer.isBuffer(req.body)) {
      await fs.writeFile(tarballPath, req.body);
    } else if (typeof req.body === "string") {
      await fs.writeFile(tarballPath, req.body, "base64");
    } else {
      return { status: 400, body: { error: "Invalid body format" } };
    }

    // Extract tarball to new deploy directory
    await fs.mkdir(newDeployDir, { recursive: true });
    await execAsync(`tar -xzf "${tarballPath}" -C "${newDeployDir}"`);

    // Run npm install if package.json exists
    const packageJsonPath = path.join(newDeployDir, "package.json");
    try {
      await fs.access(packageJsonPath);
      console.log(`Running npm install for ${targetHost}...`);
      await execAsync("npm install --production", { cwd: newDeployDir });
    } catch {
      // No package.json, skip npm install
    }

    // Update symlink (atomic rename when possible)
    const tempLink = path.join(siteDir, "current.new");
    await fs.rm(tempLink, { force: true });
    await fs.symlink(`./_deploys/${timestamp}`, tempLink);

    // Check if current is a directory (can't atomic rename over a directory)
    try {
      const stat = await fs.lstat(currentLink);
      if (stat.isDirectory()) {
        await fs.rm(currentLink, { recursive: true });
      }
    } catch {
      // current doesn't exist, that's fine
    }

    await fs.rename(tempLink, currentLink);

    // Clean up old deploys (keep last 3)
    await cleanOldDeploys(deploysDir, MAX_DEPLOYS);

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Clear function cache for this site
    clearFunctionCache(targetHost);

    // Get deploy stats
    const stats = await getDirectoryStats(newDeployDir);

    // Update site with deploy history (keep last 10)
    const deployHistory = site.deployHistory || [];
    deployHistory.unshift({
      timestamp: isoTimestamp,
      files: stats.files,
      size: stats.size,
    });
    if (deployHistory.length > MAX_HISTORY) {
      deployHistory.length = MAX_HISTORY;
    }

    await updateSite(DATA_DIR, targetHost, {
      lastDeploy: isoTimestamp,
      deployHistory,
    });

    return {
      status: 200,
      body: {
        success: true,
        host: targetHost,
        deploy: timestamp,
      },
    };
  } catch (err) {
    console.error("Deploy error:", err);

    // Clean up on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.rm(newDeployDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    return { status: 500, body: { error: err.message } };
  }
}

/**
 * Get file count and total size of a directory (excludes node_modules)
 */
async function getDirectoryStats(dir) {
  let files = 0;
  let size = 0;

  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules") continue;
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files++;
        const stat = await fs.stat(fullPath);
        size += stat.size;
      }
    }
  }

  await walk(dir);
  return { files, size };
}

/**
 * Clean up old deploys, keeping only the most recent N
 */
async function cleanOldDeploys(deploysDir, keep) {
  try {
    const entries = await fs.readdir(deploysDir, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse(); // Newest first

    // Remove old deploys
    for (let i = keep; i < dirs.length; i++) {
      const oldDir = path.join(deploysDir, dirs[i]);
      console.log(`Removing old deploy: ${dirs[i]}`);
      await fs.rm(oldDir, { recursive: true });
    }
  } catch (err) {
    console.error("Error cleaning old deploys:", err);
  }
}

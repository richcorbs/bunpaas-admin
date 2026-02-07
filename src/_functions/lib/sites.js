import { promises as fs } from "fs";
import path from "path";

// In-memory cache for sites.json
let sitesCache = null;
let sitesCacheMtime = 0;

/**
 * Get the path to sites.json
 */
function getSitesPath(dataDir) {
  return path.join(dataDir, "sites.json");
}

/**
 * Load sites.json with caching
 */
export async function loadSites(dataDir) {
  const sitesPath = getSitesPath(dataDir);

  try {
    const stat = await fs.stat(sitesPath);

    // Return cache if file hasn't changed
    if (sitesCache && stat.mtimeMs === sitesCacheMtime) {
      return sitesCache;
    }

    const content = await fs.readFile(sitesPath, "utf8");
    sitesCache = JSON.parse(content);
    sitesCacheMtime = stat.mtimeMs;

    return sitesCache;
  } catch (err) {
    if (err.code === "ENOENT") {
      return { sites: {} };
    }
    throw err;
  }
}

/**
 * Save sites.json with auto-backup
 */
export async function saveSites(dataDir, data) {
  const sitesPath = getSitesPath(dataDir);
  const backupPath = path.join(dataDir, "sites.json.backup");

  // Backup current file if it exists
  try {
    await fs.copyFile(sitesPath, backupPath);
  } catch (err) {
    // Ignore if file doesn't exist
    if (err.code !== "ENOENT") throw err;
  }

  // Write new data
  await fs.writeFile(sitesPath, JSON.stringify(data, null, 2), "utf8");

  // Update cache
  sitesCache = data;
  const stat = await fs.stat(sitesPath);
  sitesCacheMtime = stat.mtimeMs;

  return data;
}

/**
 * Get all sites
 */
export async function getSites(dataDir) {
  const data = await loadSites(dataDir);
  return data.sites || {};
}

/**
 * Get a site by host
 */
export async function getSiteByHost(dataDir, host) {
  const sites = await getSites(dataDir);
  return sites[host] || null;
}

/**
 * Get platform config
 */
export async function getPlatformConfig(dataDir) {
  const sites = await getSites(dataDir);

  // Find platform sites and derive config
  const landingHost = Object.keys(sites).find((h) => h.startsWith("bunpaas."));
  const adminHost = Object.keys(sites).find((h) => h.startsWith("bunpaas-admin."));

  return {
    landing: landingHost || "bunpaas.localhost",
    admin: adminHost || "bunpaas-admin.localhost",
  };
}

/**
 * Create a new site
 */
export async function createSite(dataDir, host, options = {}) {
  const data = await loadSites(dataDir);

  if (data.sites[host]) {
    throw new Error(`Site ${host} already exists`);
  }

  const deployKey = generateDeployKey();

  data.sites[host] = {
    enabled: true,
    deployKey,
    env: options.env || {},
    created: new Date().toISOString(),
    lastDeploy: null,
  };

  await saveSites(dataDir, data);

  // Create site directory structure
  const siteDir = path.join(dataDir, "sites", host);
  const deploysDir = path.join(siteDir, "deploys");
  await fs.mkdir(deploysDir, { recursive: true });

  return { ...data.sites[host], host };
}

/**
 * Update a site
 */
export async function updateSite(dataDir, host, updates) {
  const data = await loadSites(dataDir);

  if (!data.sites[host]) {
    throw new Error(`Site ${host} not found`);
  }

  data.sites[host] = { ...data.sites[host], ...updates };
  await saveSites(dataDir, data);

  return data.sites[host];
}

/**
 * Delete a site
 */
export async function deleteSite(dataDir, host) {
  const data = await loadSites(dataDir);

  if (!data.sites[host]) {
    throw new Error(`Site ${host} not found`);
  }

  delete data.sites[host];
  await saveSites(dataDir, data);

  // Optionally delete site directory (dangerous, so we leave it)
  // const siteDir = path.join(dataDir, "sites", host);
  // await fs.rm(siteDir, { recursive: true });

  return { deleted: true, host };
}

/**
 * Update site environment variables
 */
export async function updateSiteEnv(dataDir, host, env) {
  const data = await loadSites(dataDir);

  if (!data.sites[host]) {
    throw new Error(`Site ${host} not found`);
  }

  data.sites[host].env = env;
  await saveSites(dataDir, data);

  return data.sites[host].env;
}

/**
 * Get site environment variables
 */
export async function getSiteEnv(dataDir, host) {
  const site = await getSiteByHost(dataDir, host);
  return site?.env || {};
}

/**
 * Load site.json from a site's current directory
 */
export async function getSiteConfig(sitePath) {
  try {
    const configPath = path.join(sitePath, "site.json");
    const content = await fs.readFile(configPath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Generate a deploy key
 */
function generateDeployKey() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "dk_";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

/**
 * Generate an API key
 */
export function generateApiKey() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "ak_";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

/**
 * Invalidate the sites cache (call after external changes)
 */
export function invalidateSitesCache() {
  sitesCache = null;
  sitesCacheMtime = 0;
}

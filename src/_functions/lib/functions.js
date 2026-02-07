import path from "path";

// Function module cache (shared reference for cache clearing)
const functionCache = new Map();

/**
 * Clear the function cache for a site
 */
export function clearFunctionCache(siteHost) {
  if (!siteHost) {
    functionCache.clear();
    return;
  }

  // Clear cache entries for specific site
  const sitePrefix = path.join("/var/www/sites", siteHost);
  for (const key of functionCache.keys()) {
    if (key.startsWith(sitePrefix)) {
      functionCache.delete(key);
    }
  }
}

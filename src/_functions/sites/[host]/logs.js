import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = "/var/www";

/**
 * GET /sites/:host/logs - Get recent request logs for a site
 */
export async function get(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== req.env.API_KEY) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { host } = req.params;

  try {
    const logFile = path.join(DATA_DIR, "logs", `${host}-requests.json`);
    let logs = [];
    try {
      const content = await fs.readFile(logFile, "utf8");
      logs = JSON.parse(content);
    } catch {
      // No log file yet
    }

    return { status: 200, body: logs };
  } catch (err) {
    console.error("Error fetching logs:", err);
    return { status: 500, body: { error: err.message } };
  }
}

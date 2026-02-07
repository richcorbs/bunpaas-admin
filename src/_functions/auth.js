/**
 * Auth function - returns the API key after basic auth succeeds
 * Basic auth is handled by the platform middleware before this runs
 */
export async function get(req) {
  // If we got here, basic auth already succeeded
  // Return the API key from env vars
  const apiKey = req.env.API_KEY;

  if (!apiKey) {
    return {
      status: 500,
      body: { error: "API key not configured" },
    };
  }

  return {
    status: 200,
    body: { apiKey },
  };
}

const axios = require("axios");

const N8N_BASE_URL =
  process.env.N8N_BASE_URL || "https://p8testing.ainavi.co.uk/webhook";
const JOB_PARSER_WEBHOOK = `${N8N_BASE_URL}/job-url-parser`;

const ALLOWED_PATTERNS = [
  /^https?:\/\/(www\.)?linkedin\.com\/jobs\//i,
  /^https?:\/\/(www\.)?indeed\.com\/(job|viewjob|rc\/clk)/i,
  /^https?:\/\/(www\.)?angel\.co\/jobs\//i,
  /^https?:\/\/(www\.)?wellfound\.com\/jobs\//i,
  /^https?:\/\/(www\.)?greenhouse\.io\/jobs\//i,
  /^https?:\/\/boards\.greenhouse\.io\//i,
  /^https?:\/\/jobs\.lever\.co\//i,
  /^https?:\/\/[a-z0-9-]+\.lever\.co\//i,
  /^https?:\/\/jobs\.ashbyhq\.com\//i,
  /^https?:\/\/[a-z0-9-]+\.workable\.com\/j\//i,
  /^https?:\/\/careers\.[a-z0-9-]+\.[a-z]+\//i,
  /^https?:\/\/[a-z0-9.-]+\/(jobs|careers|job|position|opening)\//i,
];

const isAllowedUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return ALLOWED_PATTERNS.some((pattern) => pattern.test(url));
  } catch {
    return false;
  }
};

const normalizeJobData = (raw) => ({
  title: raw.title || raw.jobTitle || raw.role || "",
  company: raw.company || raw.companyName || raw.employer || "",
  description: raw.description || raw.jobDescription || raw.body || "",
  requirements: Array.isArray(raw.requirements)
    ? raw.requirements
    : typeof raw.requirements === "string"
    ? raw.requirements.split("\n").filter(Boolean)
    : [],
  location: raw.location || raw.jobLocation || "",
  salary: raw.salary || raw.compensation || raw.pay || "",
  companyInfo: raw.companyInfo || raw.about || raw.companyDescription || "",
});

const callN8nWithRetry = async (url, retries = 2, timeoutMs = 10000) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        JOB_PARSER_WEBHOOK,
        { url },
        {
          timeout: timeoutMs,
          headers: { "Content-Type": "application/json" },
        }
      );
      return response.data;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // Don't retry on 4xx (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        break;
      }
      if (attempt < retries) {
        // Brief back-off before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
};

const parseJobUrl = async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "url is required", fallback: true });
  }

  const trimmedUrl = url.trim();

  if (!isAllowedUrl(trimmedUrl)) {
    return res.status(400).json({
      error:
        "URL is not from a recognised job board or careers page. Please use LinkedIn, Indeed, AngelList, Greenhouse, Lever, or a company careers URL.",
      fallback: true,
    });
  }

  try {
    const raw = await callN8nWithRetry(trimmedUrl);

    // n8n may return an array (webhook response format)
    const data = Array.isArray(raw) ? raw[0] : raw;

    if (!data || typeof data !== "object") {
      return res.status(502).json({
        error: "Invalid response from parsing service.",
        fallback: true,
      });
    }

    const normalized = normalizeJobData(data);
    return res.json(normalized);
  } catch (err) {
    const status = err.response?.status;

    if (status === 429) {
      return res.status(429).json({
        error: "Rate limit reached. Please wait a moment and try again.",
        fallback: true,
      });
    }

    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      return res.status(504).json({
        error: "Parsing timed out. The job board may be slow to respond.",
        fallback: true,
      });
    }

    console.error("[jobParsingController] n8n call failed:", err.message);
    return res.status(502).json({
      error: "Could not fetch job data. Please paste the description manually.",
      fallback: true,
    });
  }
};

module.exports = { parseJobUrl };

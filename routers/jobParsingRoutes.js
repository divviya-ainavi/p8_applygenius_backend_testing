const express = require("express");
const { parseJobUrl } = require("../controllers/jobParsingController");

const router = express.Router();

// POST /api/parse-job-url
// Body: { url: string }
// Returns: { title, company, description, requirements, location, salary, companyInfo }
//       or { error, fallback: true } on failure
router.post("/parse-job-url", parseJobUrl);

module.exports = router;

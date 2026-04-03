const express = require('express');
const router = express.Router();
const { parseJobUrl } = require('../controllers/jobUrlParser');

const SUPPORTED_DOMAINS = ['linkedin.com', 'indeed.com', 'glassdoor.com'];

const validateJobUrl = (req, res, next) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: 'URL is required' });
  }

  try {
    const urlObj = new URL(url);
    const isSupported = SUPPORTED_DOMAINS.some((domain) =>
      urlObj.hostname.includes(domain)
    );
    if (!isSupported) {
      return res.status(400).json({
        message: 'Only LinkedIn, Indeed, and Glassdoor URLs are supported',
      });
    }
  } catch {
    return res.status(400).json({ message: 'Invalid URL format' });
  }

  next();
};

router.post('/parse-job-url', validateJobUrl, parseJobUrl);

module.exports = router;

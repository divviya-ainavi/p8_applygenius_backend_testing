const express = require('express');
const router = express.Router();
const { parseResume, extractJobKeywords } = require('../controllers/ResumeParsing');

router.post('/parse-resume', parseResume);
router.post('/api/extract-job-keywords', extractJobKeywords);

module.exports = router;

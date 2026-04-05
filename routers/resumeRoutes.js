const express = require('express');
const router = express.Router();
const { parseResume, generateComparisonData } = require('../controllers/ResumeParsing');

router.post('/parse-resume', parseResume);
router.post('/resume/comparison', generateComparisonData);

module.exports = router;

const express = require('express');
const router = express.Router();
const { parseResume } = require('../controllers/ResumeParsing');

router.post('/parse-resume', parseResume);

module.exports = router;

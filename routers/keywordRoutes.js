const express = require('express');
const router = express.Router();
const { extractKeywords, saveCorrections } = require('../controllers/keywordExtraction');

router.post('/extract-keywords', extractKeywords);
router.post('/save-keyword-corrections', saveCorrections);

module.exports = router;

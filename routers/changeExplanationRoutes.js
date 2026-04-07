const express = require('express');
const router = express.Router();
const { explainChanges } = require('../controllers/changeExplanationController');

router.post('/explain', explainChanges);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getMemory,
  saveEdits,
  updatePreferences,
  deletePreference,
  getImprovementStats,
} = require('../controllers/careerMemoryController');

router.get('/:userId', getMemory);
router.post('/edits', saveEdits);
router.put('/preferences', updatePreferences);
router.delete('/preference/:id', deletePreference);
router.get('/stats/:userId', getImprovementStats);

module.exports = router;

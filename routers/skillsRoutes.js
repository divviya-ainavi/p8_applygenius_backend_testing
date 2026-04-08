const express = require('express');
const router = express.Router();
const {
  getSkillsProfile,
  addSkill,
  updateSkill,
  deleteSkill,
  getRelevanceScore,
  getGapAnalysis,
} = require('../controllers/skillsController');

router.get('/profile', getSkillsProfile);
router.post('/', addSkill);
router.put('/:id', updateSkill);
router.delete('/:id', deleteSkill);
router.post('/relevance-score', getRelevanceScore);
router.post('/gap-analysis', getGapAnalysis);

module.exports = router;

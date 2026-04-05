const express = require('express');
const router = express.Router();
const skillsController = require('../controllers/skillsController');

router.post('/extract', skillsController.extractSkillsFromResume);
router.post('/match', skillsController.matchSkillsToJob);
router.post('/gap-analysis', skillsController.gapAnalysis);
router.get('/:userId', skillsController.getSkillsGraph);
router.post('/:userId/node', skillsController.addSkillNode);
router.put('/:userId/node/:skillId', skillsController.updateSkillNode);
router.delete('/:userId/node/:skillId', skillsController.deleteSkillNode);

module.exports = router;

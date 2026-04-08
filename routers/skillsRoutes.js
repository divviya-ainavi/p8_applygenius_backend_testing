const express = require("express");
const router = express.Router();
const {
  getSkillsProfile,
  addSkill,
  updateSkill,
  deleteSkill,
  calculateRelevanceScore,
  getGapAnalysis,
} = require("../controllers/skillsController");

router.get("/skills-profile", getSkillsProfile);
router.post("/", addSkill);
router.put("/:id", updateSkill);
router.delete("/:id", deleteSkill);
router.post("/relevance-score", calculateRelevanceScore);
router.post("/gap-analysis", getGapAnalysis);

module.exports = router;

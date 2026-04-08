const express = require("express");
const router = express.Router();
const {
  extractSkills,
  getSkillsProfile,
  updateSkills,
  calculateFitScore,
} = require("../controllers/skillsController");

router.post("/extract", extractSkills);
router.get("/profile", getSkillsProfile);
router.put("/update", updateSkills);
router.post("/fit-score", calculateFitScore);

module.exports = router;

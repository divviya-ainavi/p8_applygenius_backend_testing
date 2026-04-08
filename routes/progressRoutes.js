const express = require("express");
const router = express.Router();
const {
  receiveProgressUpdate,
  getProgressStatus,
} = require("../controllers/progressController");

router.post("/:sessionId", receiveProgressUpdate);
router.get("/:sessionId", getProgressStatus);

module.exports = router;

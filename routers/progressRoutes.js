const express = require("express");
const router = express.Router();
const {
  sseHandler,
  startHandler,
  updateHandler,
  completeHandler,
  cancelHandler,
} = require("../controllers/progressController");

// Frontend subscribes to real-time updates
router.get("/:jobId/sse", sseHandler);

// n8n workflow callbacks
router.post("/:jobId/start", startHandler);
router.post("/:jobId/update", updateHandler);
router.post("/:jobId/complete", completeHandler);

// Cancel from frontend
router.delete("/:jobId", cancelHandler);

module.exports = router;

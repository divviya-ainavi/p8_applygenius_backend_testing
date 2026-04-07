const express = require("express");
const router = express.Router();
const {
  sseConnect,
  startJob,
  updateJob,
  completeJob,
  cancelJob,
} = require("../controllers/progressController");

router.get("/:jobId/sse", sseConnect);
router.post("/:jobId/start", startJob);
router.post("/:jobId/update", updateJob);
router.post("/:jobId/complete", completeJob);
router.delete("/:jobId", cancelJob);

module.exports = router;

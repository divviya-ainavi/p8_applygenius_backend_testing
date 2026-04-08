const express = require("express");
const router = express.Router();
const { startJob, updateJob, completeJob, cancelJob, sseStream } = require("../controllers/progressController");

router.get("/:jobId/sse", sseStream);
router.post("/:jobId/start", startJob);
router.post("/:jobId/update", updateJob);
router.post("/:jobId/complete", completeJob);
router.delete("/:jobId", cancelJob);

module.exports = router;

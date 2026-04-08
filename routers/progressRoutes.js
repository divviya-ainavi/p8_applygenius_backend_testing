const express = require("express");
const router = express.Router();
const { subscribe, start, update, complete, cancel } = require("../controllers/progressController");

router.get("/:jobId/sse", subscribe);
router.post("/:jobId/start", start);
router.post("/:jobId/update", update);
router.post("/:jobId/complete", complete);
router.delete("/:jobId", cancel);

module.exports = router;

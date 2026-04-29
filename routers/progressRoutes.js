const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');

// GET /api/progress/:jobId — frontend polling endpoint
router.get('/:jobId', progressController.getProgress);

// POST /api/progress/:jobId — n8n workflow step-progress updates
router.post('/:jobId', progressController.postProgress);

// DELETE /api/progress/:jobId — cancel a running job
router.delete('/:jobId', progressController.cancelProgress);

module.exports = router;

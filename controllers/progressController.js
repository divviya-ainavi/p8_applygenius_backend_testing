const progressService = require('../services/progressService');

/**
 * GET /api/progress/:jobId
 * Returns the current progress state for a job.
 */
exports.getProgress = (req, res) => {
  const { jobId } = req.params;

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const job = progressService.getJob(jobId);

  if (!job) {
    // Return a sensible default so the frontend poller doesn't break on first poll
    // before the job entry has been written by the workflow controller.
    return res.status(200).json({
      jobId,
      currentStep: 0,
      stepLabel: 'Starting analysis...',
      percentComplete: 0,
      estimatedSecondsRemaining: null,
      status: 'running',
      errorMessage: '',
    });
  }

  return res.status(200).json(job);
};

/**
 * DELETE /api/progress/:jobId
 * Cancels a running job and removes it from the store.
 */
exports.cancelProgress = (req, res) => {
  const { jobId } = req.params;

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  progressService.cancelJob(jobId);
  progressService.deleteJob(jobId);

  return res.status(200).json({ success: true, jobId });
};

/**
 * POST /api/progress/:jobId
 * Receives step-progress updates from n8n workflow Code nodes.
 * Body: { stepLabel, percentComplete, estimatedSecondsRemaining }
 */
exports.postProgress = (req, res) => {
  const { jobId } = req.params;
  const { stepLabel, percentComplete, estimatedSecondsRemaining } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  let job = progressService.getJob(jobId);

  if (!job) {
    job = progressService.createJob(jobId);
  }

  const updated = progressService.updateStep(jobId, {
    stepLabel,
    percentComplete,
    estimatedSecondsRemaining,
  });

  return res.status(200).json(updated);
};

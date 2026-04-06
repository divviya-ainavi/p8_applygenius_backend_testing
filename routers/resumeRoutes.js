const express = require('express');
const router = express.Router();
const { parseResume } = require('../controllers/ResumeParsing');
const { jobStore } = require('../controllers/ResumeParsing');

router.post('/parse-resume', parseResume);

// GET /progress/:jobId — returns current processing status for a job
router.get('/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// POST /progress/:jobId — n8n or internal services call this to update step status
router.post('/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const { stepIndex, status, percentage, error } = req.body;
  const job = jobStore.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (job.steps[stepIndex] !== undefined) {
    job.steps[stepIndex] = { ...job.steps[stepIndex], status, percentage: percentage || 0 };
  }
  if (status === 'error') {
    job.status = 'error';
    job.error = error;
    job.stepIndex = stepIndex;
  }
  const completedCount = job.steps.filter((s) => s.status === 'completed').length;
  job.overallProgress = Math.round((completedCount / job.steps.length) * 100);
  jobStore.set(jobId, job);
  res.json({ ok: true });
});

// POST /analyze-async — starts a background analysis job and immediately returns jobId
router.post('/analyze-async', async (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const jobId = uuidv4();

  const initialJob = {
    jobId,
    status: 'processing',
    overallProgress: 0,
    steps: [
      { id: 'extract', label: 'Extracting resume text', status: 'active', percentage: 0 },
      { id: 'keywords', label: 'Scanning for ATS keywords', status: 'pending', percentage: 0 },
      { id: 'bullets', label: 'Generating tailored bullets', status: 'pending', percentage: 0 },
      { id: 'suggestions', label: 'Creating suggestions', status: 'pending', percentage: 0 },
    ],
    createdAt: Date.now(),
  };

  jobStore.set(jobId, initialJob);
  res.json({ jobId });
});

module.exports = router;

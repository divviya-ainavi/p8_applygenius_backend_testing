/**
 * In-memory job progress store.
 * Keys are jobId strings; values are progress state objects.
 */
const jobStore = new Map();

// Auto-clean entries older than 1 hour to prevent memory leaks
const TTL_MS = 60 * 60 * 1000;

function pruneExpired() {
  const now = Date.now();
  for (const [id, entry] of jobStore.entries()) {
    if (now - entry.createdAt > TTL_MS) {
      jobStore.delete(id);
    }
  }
}

/**
 * Create a new job progress entry.
 * @param {string} jobId
 * @returns {object} initial progress state
 */
function createJob(jobId) {
  pruneExpired();
  const entry = {
    jobId,
    currentStep: 0,
    stepLabel: "Starting analysis...",
    percentComplete: 0,
    estimatedSecondsRemaining: null,
    status: "running",
    errorMessage: "",
    createdAt: Date.now(),
  };
  jobStore.set(jobId, entry);
  return entry;
}

/**
 * Update progress for an existing job.
 * @param {string} jobId
 * @param {object} update - { stepLabel, percentComplete, estimatedSecondsRemaining }
 * @returns {object|null} updated entry or null if not found
 */
function updateStep(jobId, { stepLabel, percentComplete, estimatedSecondsRemaining }) {
  const entry = jobStore.get(jobId);
  if (!entry) return null;

  if (stepLabel !== undefined) entry.stepLabel = stepLabel;
  if (percentComplete !== undefined) entry.percentComplete = percentComplete;
  if (estimatedSecondsRemaining !== undefined) entry.estimatedSecondsRemaining = estimatedSecondsRemaining;
  entry.status = "running";
  entry.currentStep = (entry.currentStep || 0) + 1;

  jobStore.set(jobId, entry);
  return entry;
}

/**
 * Mark a job as complete.
 * @param {string} jobId
 */
function completeJob(jobId) {
  const entry = jobStore.get(jobId);
  if (!entry) return;
  entry.status = "complete";
  entry.percentComplete = 100;
  entry.estimatedSecondsRemaining = 0;
  jobStore.set(jobId, entry);
}

/**
 * Mark a job as failed with an error message.
 * @param {string} jobId
 * @param {string} errorMessage
 */
function failJob(jobId, errorMessage) {
  const entry = jobStore.get(jobId);
  if (!entry) return;
  entry.status = "error";
  entry.errorMessage = errorMessage || "Processing failed";
  jobStore.set(jobId, entry);
}

/**
 * Mark a job as cancelled.
 * @param {string} jobId
 */
function cancelJob(jobId) {
  const entry = jobStore.get(jobId);
  if (!entry) return;
  entry.status = "cancelled";
  jobStore.set(jobId, entry);
}

/**
 * Get the current state of a job.
 * @param {string} jobId
 * @returns {object|null}
 */
function getJob(jobId) {
  return jobStore.get(jobId) || null;
}

/**
 * Delete a job entry entirely.
 * @param {string} jobId
 */
function deleteJob(jobId) {
  jobStore.delete(jobId);
}

module.exports = {
  createJob,
  updateStep,
  completeJob,
  failJob,
  cancelJob,
  getJob,
  deleteJob,
};

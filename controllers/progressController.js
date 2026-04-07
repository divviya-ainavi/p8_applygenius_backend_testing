/**
 * Progress Controller
 * Manages real-time SSE progress streaming for AI CV analysis jobs.
 * n8n CV-Engine calls POST /progress/:jobId/start|update|complete to push state.
 * Frontend subscribes via GET /progress/:jobId/sse to receive updates.
 */

// In-memory store: jobId -> { clients: Set<res>, state: Object }
const jobs = new Map();

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getOrCreateJob(jobId) {
  if (!jobs.has(jobId)) {
    jobs.set(jobId, {
      clients: new Set(),
      state: {
        jobId,
        currentStep: null,
        steps: [],
        overallProgress: 0,
        estimatedTimeRemaining: null,
        status: "pending",
        error: null,
        isCancelled: false,
      },
      timer: setTimeout(() => jobs.delete(jobId), DEFAULT_TTL_MS),
    });
  }
  return jobs.get(jobId);
}

function broadcast(job, payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of job.clients) {
    try {
      client.write(data);
    } catch {
      job.clients.delete(client);
    }
  }
}

// GET /progress/:jobId/sse
const sseConnect = (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const job = getOrCreateJob(jobId);
  job.clients.add(res);

  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify({ type: "snapshot", ...job.state })}\n\n`);

  // Heartbeat every 20s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    job.clients.delete(res);
  });
};

// POST /progress/:jobId/start
const startJob = (req, res) => {
  const { jobId } = req.params;
  const { steps } = req.body;

  const job = getOrCreateJob(jobId);
  job.state.status = "running";
  job.state.steps = Array.isArray(steps) ? steps : [];
  job.state.overallProgress = 0;
  job.state.isCancelled = false;
  job.state.error = null;

  broadcast(job, { type: "start", ...job.state });

  res.json({ ok: true, jobId });
};

// POST /progress/:jobId/update
const updateJob = (req, res) => {
  const { jobId } = req.params;
  const { stepName, description, percentage, estimatedSecondsRemaining, status } = req.body;

  if (!jobs.has(jobId)) {
    return res.status(404).json({ error: "Job not found" });
  }

  const job = jobs.get(jobId);

  if (job.state.isCancelled) {
    return res.status(409).json({ error: "Job cancelled" });
  }

  // Update step in steps array
  const existingIndex = job.state.steps.findIndex((s) => s.name === stepName);
  const stepData = {
    name: stepName,
    description: description || "",
    percentage: percentage ?? 0,
    status: status || "in_progress",
  };

  if (existingIndex >= 0) {
    job.state.steps[existingIndex] = stepData;
  } else {
    job.state.steps.push(stepData);
  }

  job.state.currentStep = stepName;
  if (percentage != null) job.state.overallProgress = percentage;
  if (estimatedSecondsRemaining != null) job.state.estimatedTimeRemaining = estimatedSecondsRemaining;

  broadcast(job, {
    type: "update",
    stepName,
    description,
    percentage,
    estimatedSecondsRemaining,
    status: status || "in_progress",
  });

  res.json({ ok: true });
};

// POST /progress/:jobId/complete
const completeJob = (req, res) => {
  const { jobId } = req.params;

  if (!jobs.has(jobId)) {
    return res.status(404).json({ error: "Job not found" });
  }

  const job = jobs.get(jobId);
  job.state.status = "completed";
  job.state.overallProgress = 100;

  broadcast(job, { type: "complete", overallProgress: 100 });

  // Clean up after a short delay to allow final reads
  setTimeout(() => jobs.delete(jobId), 60000);

  res.json({ ok: true });
};

// DELETE /progress/:jobId
const cancelJob = (req, res) => {
  const { jobId } = req.params;

  if (!jobs.has(jobId)) {
    return res.status(404).json({ error: "Job not found" });
  }

  const job = jobs.get(jobId);
  job.state.isCancelled = true;
  job.state.status = "cancelled";

  broadcast(job, { type: "cancelled" });

  jobs.delete(jobId);

  res.json({ ok: true });
};

module.exports = { sseConnect, startJob, updateJob, completeJob, cancelJob };

// In-memory store: jobId -> { state, clients }
const jobs = new Map();

function getOrCreateJob(jobId) {
  if (!jobs.has(jobId)) {
    jobs.set(jobId, {
      steps: [],
      overallProgress: 0,
      estimatedTimeRemaining: null,
      isCancelled: false,
      isComplete: false,
      clients: [],
    });
  }
  return jobs.get(jobId);
}

function broadcast(job, eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  job.clients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      // ignore broken connections
    }
  });
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
  job.clients.push(res);

  // Send current state immediately on connect
  if (job.steps.length > 0) {
    job.steps.forEach((step) => {
      res.write(`event: step\ndata: ${JSON.stringify(step)}\n\n`);
    });
  }

  if (job.isComplete) {
    res.write(`event: complete\ndata: {}\n\n`);
  }

  if (job.isCancelled) {
    res.write(`event: cancelled\ndata: {}\n\n`);
  }

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const idx = job.clients.indexOf(res);
    if (idx >= 0) job.clients.splice(idx, 1);
  });
};

// POST /progress/:jobId/start
const startJob = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);
  job.steps = [];
  job.overallProgress = 0;
  job.isCancelled = false;
  job.isComplete = false;

  const stepData = req.body || {};
  if (stepData.name) {
    const step = {
      name: stepData.name,
      description: stepData.description || "",
      percentage: stepData.percentage ?? 0,
      estimatedSecondsRemaining: stepData.estimatedSecondsRemaining ?? null,
      status: "active",
    };
    job.steps.push(step);
    job.overallProgress = step.percentage;
    job.estimatedTimeRemaining = step.estimatedSecondsRemaining;
    broadcast(job, "step", step);
  }

  res.json({ ok: true });
};

// POST /progress/:jobId/update
const updateJob = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);

  if (job.isCancelled) {
    return res.status(409).json({ ok: false, reason: "cancelled" });
  }

  const stepData = req.body || {};
  const step = {
    name: stepData.name || "Processing",
    description: stepData.description || "",
    percentage: stepData.percentage ?? job.overallProgress,
    estimatedSecondsRemaining: stepData.estimatedSecondsRemaining ?? null,
    status: "active",
  };

  // Mark previous active step as complete
  job.steps.forEach((s) => {
    if (s.status === "active") s.status = "complete";
  });

  job.steps.push(step);
  job.overallProgress = step.percentage;
  job.estimatedTimeRemaining = step.estimatedSecondsRemaining;

  broadcast(job, "step", step);
  res.json({ ok: true });
};

// POST /progress/:jobId/complete
const completeJob = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);

  job.steps.forEach((s) => {
    if (s.status === "active") s.status = "complete";
  });
  job.overallProgress = 100;
  job.isComplete = true;

  broadcast(job, "complete", { percentage: 100 });

  // Clean up after a short delay
  setTimeout(() => jobs.delete(jobId), 30000);

  res.json({ ok: true });
};

// DELETE /progress/:jobId
const cancelJob = (req, res) => {
  const { jobId } = req.params;
  if (!jobs.has(jobId)) {
    return res.status(404).json({ ok: false, reason: "not found" });
  }

  const job = jobs.get(jobId);
  job.isCancelled = true;

  broadcast(job, "cancelled", {});

  // Close all SSE clients
  job.clients.forEach((clientRes) => {
    try {
      clientRes.end();
    } catch {
      // ignore
    }
  });
  job.clients = [];

  jobs.delete(jobId);
  res.json({ ok: true });
};

module.exports = { sseConnect, startJob, updateJob, completeJob, cancelJob };

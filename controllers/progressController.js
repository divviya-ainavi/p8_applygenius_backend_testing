const progressJobs = new Map();

// Clean up stale jobs after 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of progressJobs.entries()) {
    if (now - job.createdAt > 3600000) {
      for (const client of job.clients) {
        try { client.end(); } catch (_) {}
      }
      progressJobs.delete(jobId);
    }
  }
}, 300000);

const getOrCreateJob = (jobId) => {
  if (!progressJobs.has(jobId)) {
    progressJobs.set(jobId, {
      createdAt: Date.now(),
      clients: [],
      lastEvent: null,
      cancelled: false,
    });
  }
  return progressJobs.get(jobId);
};

const broadcast = (job, event) => {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of job.clients) {
    try { client.write(payload); } catch (_) {}
  }
};

const startJob = (req, res) => {
  const { jobId } = req.params;
  getOrCreateJob(jobId);
  res.json({ success: true });
};

const updateJob = (req, res) => {
  const { jobId } = req.params;
  const { name, description, percentage, estimatedSecondsRemaining } = req.body;

  const job = getOrCreateJob(jobId);
  const event = {
    type: "update",
    name,
    description,
    percentage: percentage ?? 0,
    estimatedSecondsRemaining: estimatedSecondsRemaining ?? null,
    status: "active",
  };
  job.lastEvent = event;
  broadcast(job, event);

  res.json({ success: true });
};

const completeJob = (req, res) => {
  const { jobId } = req.params;
  const job = progressJobs.get(jobId);

  if (job) {
    const event = { type: "complete" };
    broadcast(job, event);
    for (const client of job.clients) {
      try { client.end(); } catch (_) {}
    }
    job.clients = [];
  }

  res.json({ success: true });
};

const cancelJob = (req, res) => {
  const { jobId } = req.params;
  const job = progressJobs.get(jobId);

  if (job) {
    job.cancelled = true;
    const event = { type: "error", message: "Analysis was cancelled." };
    broadcast(job, event);
    for (const client of job.clients) {
      try { client.end(); } catch (_) {}
    }
    progressJobs.delete(jobId);
  }

  res.json({ success: true });
};

const sseStream = (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Initial heartbeat
  res.write(": heartbeat\n\n");

  const job = getOrCreateJob(jobId);

  // Replay last known event for reconnects
  if (job.lastEvent) {
    res.write(`data: ${JSON.stringify(job.lastEvent)}\n\n`);
  }

  job.clients.push(res);

  // Keep-alive heartbeat every 15 seconds
  const heartbeatInterval = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch (_) { clearInterval(heartbeatInterval); }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeatInterval);
    const current = progressJobs.get(jobId);
    if (current) {
      current.clients = current.clients.filter((c) => c !== res);
    }
  });
};

module.exports = { startJob, updateJob, completeJob, cancelJob, sseStream };

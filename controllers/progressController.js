// In-memory stores keyed by jobId
const jobStates = new Map();
const jobClients = new Map(); // jobId -> Set of SSE response objects

function getOrCreateJob(jobId) {
  if (!jobStates.has(jobId)) {
    jobStates.set(jobId, {
      steps: [],
      currentStep: null,
      overallProgress: 0,
      estimatedTimeRemaining: null,
      status: "pending", // pending | active | completed | cancelled | error
      error: null,
    });
  }
  return jobStates.get(jobId);
}

function pushToClients(jobId, event, data) {
  const clients = jobClients.get(jobId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

function cleanupJob(jobId) {
  setTimeout(() => {
    jobStates.delete(jobId);
    jobClients.delete(jobId);
  }, 30000); // retain state 30 s after completion for late SSE subscribers
}

// GET /progress/:jobId/sse
const subscribe = (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send keep-alive comment every 20 s
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  if (!jobClients.has(jobId)) {
    jobClients.set(jobId, new Set());
  }
  jobClients.get(jobId).add(res);

  // Replay existing state for late-joining clients
  const job = jobStates.get(jobId);
  if (job) {
    for (const step of job.steps) {
      res.write(`event: step\ndata: ${JSON.stringify(step)}\n\n`);
    }
    if (job.status === "completed") {
      res.write(`event: complete\ndata: ${JSON.stringify({ message: "done" })}\n\n`);
    } else if (job.status === "error" && job.error) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: job.error })}\n\n`);
    }
  }

  req.on("close", () => {
    clearInterval(heartbeat);
    const clients = jobClients.get(jobId);
    if (clients) clients.delete(res);
  });
};

// POST /progress/:jobId/start
const start = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);
  job.status = "active";
  const stepData = {
    name: req.body.name || "Starting",
    description: req.body.description || "Initializing analysis...",
    percentage: req.body.percentage || 0,
    estimatedSecondsRemaining: req.body.estimatedSecondsRemaining ?? null,
    status: "active",
  };
  job.steps = [stepData];
  job.currentStep = stepData.name;
  job.overallProgress = stepData.percentage;
  job.estimatedTimeRemaining = stepData.estimatedSecondsRemaining;
  pushToClients(jobId, "step", stepData);
  res.json({ ok: true });
};

// POST /progress/:jobId/update
const update = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);
  const stepData = {
    name: req.body.name || "Processing",
    description: req.body.description || "",
    percentage: req.body.percentage ?? job.overallProgress,
    estimatedSecondsRemaining: req.body.estimatedSecondsRemaining ?? null,
    status: "active",
  };

  const existingIndex = job.steps.findIndex((s) => s.name === stepData.name);
  if (existingIndex >= 0) {
    job.steps[existingIndex] = stepData;
  } else {
    if (job.steps.length > 0) {
      job.steps[job.steps.length - 1].status = "completed";
    }
    job.steps.push(stepData);
  }
  job.currentStep = stepData.name;
  job.overallProgress = stepData.percentage;
  job.estimatedTimeRemaining = stepData.estimatedSecondsRemaining;

  pushToClients(jobId, "step", stepData);
  res.json({ ok: true });
};

// POST /progress/:jobId/complete
const complete = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);
  job.status = "completed";
  job.overallProgress = 100;
  job.steps = job.steps.map((s) => ({ ...s, status: "completed" }));
  pushToClients(jobId, "complete", { message: "done" });
  cleanupJob(jobId);
  res.json({ ok: true });
};

// DELETE /progress/:jobId
const cancel = (req, res) => {
  const { jobId } = req.params;
  const job = jobStates.get(jobId);
  if (job) {
    job.status = "cancelled";
  }
  // Close all SSE connections for this job
  const clients = jobClients.get(jobId);
  if (clients) {
    for (const clientRes of clients) {
      try {
        clientRes.end();
      } catch {
        // ignore
      }
    }
    clients.clear();
  }
  jobStates.delete(jobId);
  jobClients.delete(jobId);
  res.json({ ok: true });
};

module.exports = { subscribe, start, update, complete, cancel };

/**
 * Progress Controller
 * Manages real-time SSE progress updates from n8n workflows to the frontend.
 * n8n HTTP nodes POST step data here; the frontend subscribes via SSE.
 */

// In-memory store: jobId -> { steps, clients, cancelled }
const jobs = new Map();

function getOrCreateJob(jobId) {
  if (!jobs.has(jobId)) {
    jobs.set(jobId, { steps: [], clients: [], cancelled: false, completed: false });
  }
  return jobs.get(jobId);
}

function broadcast(job, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  job.clients.forEach((res) => {
    try {
      res.write(payload);
    } catch (_) {
      // client disconnected
    }
  });
}

// GET /progress/:jobId/sse
// Frontend subscribes here to receive real-time updates.
const sseHandler = (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const job = getOrCreateJob(jobId);
  job.clients.push(res);

  // Send any already-received steps so a reconnecting client catches up
  if (job.steps.length > 0) {
    job.steps.forEach((step) => {
      res.write(`event: update\ndata: ${JSON.stringify(step)}\n\n`);
    });
  }

  if (job.completed) {
    res.write(`event: complete\ndata: ${JSON.stringify({ percentage: 100 })}\n\n`);
  }

  if (job.cancelled) {
    res.write(`event: cancelled\ndata: ${JSON.stringify({ jobId })}\n\n`);
  }

  // Keep-alive ping every 20 seconds
  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch (_) {
      clearInterval(keepAlive);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(keepAlive);
    job.clients = job.clients.filter((c) => c !== res);
  });
};

// POST /progress/:jobId/start
// Called by n8n when the workflow begins.
const startHandler = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);
  job.steps = [];
  job.completed = false;
  job.cancelled = false;

  const data = { jobId, started: true, ...req.body };
  broadcast(job, "start", data);
  res.json({ ok: true });
};

// POST /progress/:jobId/update
// Called by n8n Progress Update HTTP nodes with step metadata.
const updateHandler = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);

  if (job.cancelled) {
    return res.status(409).json({ ok: false, reason: "cancelled" });
  }

  const { name, description, percentage, estimatedSecondsRemaining, status } = req.body;
  const step = {
    name: name || "Processing",
    description: description || "",
    percentage: typeof percentage === "number" ? percentage : 0,
    estimatedSecondsRemaining: typeof estimatedSecondsRemaining === "number" ? estimatedSecondsRemaining : null,
    status: status || "in_progress",
  };

  // Upsert step by name
  const idx = job.steps.findIndex((s) => s.name === step.name);
  if (idx >= 0) {
    job.steps[idx] = step;
  } else {
    job.steps.push(step);
  }

  broadcast(job, "update", step);
  res.json({ ok: true });
};

// POST /progress/:jobId/complete
// Called by n8n when the workflow finishes successfully.
const completeHandler = (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);
  job.completed = true;

  const data = { jobId, percentage: 100, ...req.body };
  broadcast(job, "complete", data);

  // Clean up after a delay so reconnecting clients can still read state
  setTimeout(() => jobs.delete(jobId), 60000);
  res.json({ ok: true });
};

// DELETE /progress/:jobId
// Called by frontend cancel button; signals n8n to stop.
const cancelHandler = (req, res) => {
  const { jobId } = req.params;
  if (!jobs.has(jobId)) {
    return res.status(404).json({ ok: false, reason: "not found" });
  }

  const job = jobs.get(jobId);
  job.cancelled = true;

  broadcast(job, "cancelled", { jobId });
  setTimeout(() => jobs.delete(jobId), 30000);
  res.json({ ok: true });
};

module.exports = { sseHandler, startHandler, updateHandler, completeHandler, cancelHandler };

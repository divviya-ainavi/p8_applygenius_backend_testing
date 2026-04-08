const progressSessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of progressSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      progressSessions.delete(id);
    }
  }
}

const receiveProgressUpdate = (req, res) => {
  pruneExpiredSessions();

  const { sessionId } = req.params;
  const { step, percent, status } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  if (!progressSessions.has(sessionId)) {
    progressSessions.set(sessionId, {
      sessionId,
      steps: [],
      isComplete: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  const session = progressSessions.get(sessionId);

  const existingIndex = session.steps.findIndex((s) => s.name === step);
  const stepEntry = {
    name: step,
    percent: typeof percent === "number" ? percent : parseInt(percent, 10) || 0,
    status: status || "in_progress",
    timestamp: Date.now(),
  };

  if (existingIndex >= 0) {
    session.steps[existingIndex] = stepEntry;
  } else {
    session.steps.push(stepEntry);
  }

  session.updatedAt = Date.now();

  if (status === "completed" && percent >= 100) {
    const allDone = session.steps.every((s) => s.status === "completed");
    if (allDone) {
      session.isComplete = true;
    }
  }

  return res.status(200).json({ success: true, session });
};

const getProgressStatus = (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  if (!progressSessions.has(sessionId)) {
    return res.status(200).json({
      sessionId,
      steps: [],
      isComplete: false,
    });
  }

  const session = progressSessions.get(sessionId);
  return res.status(200).json(session);
};

module.exports = { receiveProgressUpdate, getProgressStatus };

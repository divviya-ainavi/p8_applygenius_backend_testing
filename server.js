const express = require("express");
const cors = require("cors");
const pdfRoutes = require("./routers/pdfRoutes");
const resumeRoutes = require('./routers/resumeRoutes');
const { jobStore } = require('./controllers/ResumeParsing');
const dotenv = require('dotenv');

// dotenv.config();
dotenv.config({ path: '/home/devops/deploy/UI_env/.env' });

const app = express();
const PORT = 2000;

app.use(cors());
app.use(express.json());

app.use("/pdf", pdfRoutes);
app.use('/', resumeRoutes);

// SSE endpoint: GET /api/progress-stream/:jobId
// Streams live progress updates from the in-memory job store to the client
app.get('/api/progress-stream/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendUpdate = () => {
    const job = jobStore.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
      return;
    }
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (job.status === 'completed' || job.status === 'error') {
      clearInterval(interval);
      res.end();
    }
  };

  const interval = setInterval(sendUpdate, 1000);
  sendUpdate();

  req.on('close', () => {
    clearInterval(interval);
  });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

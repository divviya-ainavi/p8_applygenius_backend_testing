const express = require("express");
const cors = require("cors");
const pdfRoutes = require("./routers/pdfRoutes");
const resumeRoutes = require('./routers/resumeRoutes');
const dotenv = require('dotenv');

// dotenv.config();
dotenv.config({ path: '/home/devops/deploy/UI_env/.env' });

const app = express();
const PORT = 2000;

app.use(cors());
app.use(express.json());

app.use("/pdf", pdfRoutes);
app.use('/', resumeRoutes);

// Impact analysis: health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'applygenius-backend' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} `);
});

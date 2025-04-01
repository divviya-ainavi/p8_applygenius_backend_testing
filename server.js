const express = require("express");
const cors = require("cors");
const pdfRoutes = require("./routers/pdfRoutes");

const app = express();
const PORT = 2000;

app.use(cors());
app.use(express.json());

app.use("/pdf", pdfRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

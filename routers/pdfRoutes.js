const express = require("express");
const path = require("path");
const { generatePdfBuffer, generateHtmlPreview } = require("../controllers/generatepdf");

const router = express.Router();

router.post("/resume/download-pdf", async (req, res) => {

    const { templatename, ...resumeData } = req.body;

    const data = resumeData?.resumeData
    const tempName = resumeData?.resumeData?.templatename
    // const data = resumeData
    // const tempName = templatename
    // if (!templatename || !resumeData) {
    //     return res.status(400).json({ error: "templatename and data are required." });
    // }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeFirst = data?.firstName?.replace(/\s+/g, "_") || "User";
    const safeLast = data?.lastName?.replace(/\s+/g, "_") || "Resume";
    const filename = `${safeFirst}_${safeLast}_Resume_${timestamp}.pdf`;

    try {
        const pdfBuffer = await generatePdfBuffer(tempName || "Harvard", data);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${filename}`,
            "Content-Length": pdfBuffer.length,
        });

        return res.end(pdfBuffer);
    } catch (error) {
        console.error("PDF generation error:", error);
        return res.status(500).json({ error: "Failed to generate PDF." });
    }
});

router.get("/preview-template", async (req, res) => {
    const { ...resumeData } = req.body;
    const data = resumeData?.resumeData
    const tempName = "Harvard"
    // console.log(data, "template name")
    try {
        const html = await generateHtmlPreview(tempName, data);
        res.setHeader("Content-Type", "text/html");
        res.send(html);
    } catch (err) {
        console.error("HTML preview generation failed:", err);
        res.status(500).json({ error: "Failed to generate HTML preview" });
    }
});

module.exports = router;

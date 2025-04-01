const puppeteer = require("puppeteer");
const { create } = require("express-handlebars");
const path = require("path");
const fs = require("fs/promises");

// Setup Handlebars
const hbs = create({ extname: ".handlebars", defaultLayout: false });

// ✅ Register the 'or' helper after creating the Handlebars instance
hbs.handlebars.registerHelper("or", function () {
    return Array.from(arguments).slice(0, -1).some(Boolean);
});
// Transform data function
const transformResumeData = (data) => {
    const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
    const location = `${data.location?.city || ""}, ${data.location?.country || ""}`.trim();
    const getInitials = (firstName, lastName) => {
        const firstInitial = firstName?.charAt(0)?.toUpperCase() || "";
        const lastInitial = lastName?.charAt(0)?.toUpperCase() || "";
        return firstInitial + lastInitial;
    };
    return {
        initials: getInitials(
            data?.firstName,
            data?.lastName
        ),
        name: fullName,
        jobTitle: data.appliedJobTitle,
        email: data.email,
        location,
        phoneNumber: data.phoneNumber,
        linkedin: data.linkedinProfile,
        summary: data.summary,
        skills: data.skills?.map((s) => s.name) || [],
        experience:
            data.experience?.map((exp) => ({
                company: exp.companyName,
                title: exp.position,
                duration: `${exp.from || ""} ${exp.from && "-"} ${exp.to || "Present"}`,
                responsibilities: exp.keyAchievements || [],
            })) || [],
        education:
            data.education?.map((ed) => ({
                degree: ed.degree,
                institution: ed.institution,
                year: `${ed.from || ""} ${ed.from && ed.to && "-"} ${ed.to || "Present"}`,
                score: ed.description,
            })) || [],
        customsections:
            data.customSections?.map((section) => ({
                title: section.title,
                items:
                    section.items?.map((item) => ({
                        title: item.name,
                        location: item.location,
                        date: `${item.startDate} ${item.startDate && item.endDate && "-"} ${item.endDate}`,
                        description: item.description,
                    })) || [],
            })) || [],
    };
};

async function generatePdfBuffer(templateName, resumeData) {
    const templatePath = path.join(__dirname, "../templates", `${templateName}.handlebars`);
    const rawTemplate = await fs.readFile(templatePath, "utf-8");
    const compiled = hbs.handlebars.compile(rawTemplate);
    const transformedData = transformResumeData(resumeData);
    const filledHTML = compiled(transformedData);

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none",
            "--force-color-profile=srgb"],
    });

    const page = await browser.newPage();
    await page.setContent(filledHTML, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "7mm", bottom: "5mm", left: "5mm", right: "5mm" },
    });

    await page.close();
    await browser.close();

    return pdfBuffer;
}

module.exports = { generatePdfBuffer };

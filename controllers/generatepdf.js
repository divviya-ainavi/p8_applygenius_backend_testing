const puppeteer = require("puppeteer");
const { create } = require("express-handlebars");
const path = require("path");
const fs = require("fs/promises");
const moment = require("moment");
const htmlToDocx = require("html-to-docx");


// Setup Handlebars
const hbs = create({ extname: ".handlebars", defaultLayout: false });


// ✅ Register the 'or' helper after creating the Handlebars instance
hbs.handlebars.registerHelper("or", function () {
  return Array.from(arguments).slice(0, -1).some(Boolean);
});

hbs.handlebars.registerHelper("not", function (value) {
  return !value;
});

hbs.handlebars.registerHelper("and", function () {
  return Array.from(arguments).slice(0, -1).every(Boolean);
});

hbs.handlebars.registerHelper("orNotEmpty", function (...args) {
  const options = args.pop(); // remove handlebars options object
  return args.some(val => typeof val === "string" ? val.trim() !== "" : !!val);
});

// Transform data function

const formatDateExp = (dateString, todateString, type) => {
  // console.log(dateString, "date string");
  // console.log(todateString, "to date string");

  if (!dateString || typeof dateString !== "string") return "";

  const lower = dateString.toLowerCase().trim();

  // Handle special cases like "present"
  if (["present", "till date"].includes(lower)) {
    return "Present";
  }

  const formats = [
    "MMM YYYY", // e.g., "Sep 2024"
    "MMMM YYYY", // e.g., "September 2024"
    "MM-YYYY", // e.g., "09-2024"
    "YYYY-MM", // e.g., "2024-09"
    "MM/YYYY", // e.g., "09/2024"
    "YYYY/MM", // e.g., "2024/09"
    "YYYY", // e.g., "2024"
  ];

  const parsed = moment(dateString, formats, true); // strict parsing
  // console.log(todateString, "to date string");
  return parsed.isValid()
    ? ((["present", "till date"].includes(
      todateString?.toLowerCase()?.trim()
    ) ||
      todateString == "" ||
      todateString == null) &&
      todateString != undefined || type == "education")
      ? parsed.format("MMM YYYY")
      : parsed.format("YYYY")
    : "";
};

const transformResumeData = (data) => {
  const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
  const location = `${data.location?.city || ""} ${data.location?.city && data.location?.country && ","} ${data.location?.country || ""}`.trim();
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
    skills: data.skills?.map((s) => s.name || s) || [],
    experience:
      data.experience?.map((exp) => ({
        company: exp.companyName,
        title: exp.position,
        duration: `${formatDateExp(exp?.from, exp?.to) || ""} ${exp.from && "-"} ${formatDateExp(exp.to) || "Present"}`,
        responsibilities: exp.keyAchievements || [],
      })) || [],
    education:
      data.education?.map((ed) => ({
        degree: ed.degree,
        institution: ed.institution,
        year: `${formatDateExp(ed?.from, ed?.to, "education") || ""} ${ed.from && ed.to && "-"} ${formatDateExp(ed?.to, "", "education")}`,
        score: ed.description,
      })) || [],
    customsections:
      data.customSections?.map((section) => ({
        title: section.title,
        items:
          section.items?.map((item) => ({
            title: item.name,
            location: item.location,
            date: `${formatDateExp(item?.startDate, item?.endDate)} ${item.startDate && item.endDate && "-"} ${formatDateExp(item.endDate)}`,
            description: item.description,
          })) || [],
      })) || [],
  };
};

// Function to generate CSS based on page limit
const getPageLimitCSS = (pageLimit) => {
  // Default (no limit or invalid value)
  if (!pageLimit || ![1, 2, 3].includes(pageLimit)) {
    return '';

  }

  const baseStyles = `
    <style>
      @page {
        size: A4;
        margin: 0;
      }
  `;

  // 1-page resume: Very compact
  if (pageLimit === 1) {
    return baseStyles + `
      body {
        font-size: 9px !important;
        line-height: 1.2 !important;
        max-height: 297mm;
        overflow: hidden;
      }
      h1, h2, h3, h4, h5, h6 {
        margin: 3px 0 !important;
        font-size: 11px !important;
      }
      p, li, div {
        margin: 2px 0 !important;
        padding: 1px 0 !important;
        font-size: 9px !important;
      }
      section, .section {
        margin-bottom: 6px !important;
        padding: 4px 0 !important;
      }
      ul, ol {
        margin: 2px 0 !important;
        padding-left: 12px !important;
      }
      .experience-item, .education-item, .project-item {
        margin-bottom: 4px !important;
      }
    </style>
  `;
  }

  // 2-page resume: Moderately compact
  if (pageLimit === 2) {
    return baseStyles + `
      body {
        font-size: 10px !important;
        line-height: 1.3 !important;
        max-height: 594mm;
        overflow: hidden;
      }
      h1, h2, h3, h4, h5, h6 {
        margin: 4px 0 !important;
        font-size: 12px !important;
      }
      p, li, div {
        margin: 3px 0 !important;
        padding: 2px 0 !important;
        font-size: 10px !important;
      }
      section, .section {
        margin-bottom: 8px !important;
        padding: 5px 0 !important;
      }
      ul, ol {
        margin: 3px 0 !important;
        padding-left: 15px !important;
      }
      .experience-item, .education-item, .project-item {
        margin-bottom: 6px !important;
      }
      @page:first {
        page-break-after: always;
      }
    </style>
  `;
  }

  // 3-page resume: Normal spacing
  if (pageLimit === 3) {
    return baseStyles + `
      body {
        font-size: 11px !important;
        line-height: 1.4 !important;
        max-height: 891mm;
        overflow: hidden;
      }
      h1, h2, h3, h4, h5, h6 {
        margin: 5px 0 !important;
        font-size: 13px !important;
      }
      p, li, div {
        margin: 4px 0 !important;
        padding: 2px 0 !important;
        font-size: 11px !important;
      }
      section, .section {
        margin-bottom: 10px !important;
        padding: 6px 0 !important;
      }
      ul, ol {
        margin: 4px 0 !important;
        padding-left: 18px !important;
      }
      .experience-item, .education-item, .project-item {
        margin-bottom: 8px !important;
      }
    </style>
  `;
  }
};

async function generatePdfBuffer(templateName, resumeData, pageLimit = null) {
  const templatePath = path.join(__dirname, "../templates", `${templateName}.handlebars`);
  const rawTemplate = await fs.readFile(templatePath, "utf-8");
  const compiled = hbs.handlebars.compile(rawTemplate);
  const transformedData = transformResumeData(resumeData);
  const filledHTML = compiled(transformedData);

  // Inject page limit CSS if specified
  const pageLimitCSS = getPageLimitCSS(pageLimit);
  const finalHTML = pageLimitCSS ? `${pageLimitCSS}\n${filledHTML}` : filledHTML;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none",
      "--force-color-profile=srgb"],
  });

  const page = await browser.newPage();
  await page.setContent(finalHTML, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "7mm", bottom: "5mm", left: "5mm", right: "5mm" },
  });

  await page.close();
  await browser.close();

  return pdfBuffer;
}

async function generateHtmlPreview(templateName, resumeData) {
  // console.log("preview api called")
  const templatePath = path.join(__dirname, "../templates", `${templateName || "Harvard"}.handlebars`);
  const rawTemplate = await fs.readFile(templatePath, "utf-8");
  const compiled = hbs.handlebars.compile(rawTemplate);
  const transformedData = transformResumeData(resumeData);

  // console.log(transformResumeData, "transformed data ")

  const filledHTML = compiled(transformedData);

  // Wrap with full HTML shell and styling
  const fullHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Resume Preview</title>
        <style>
          body {
            margin: 0;
            padding: 40px;
            background-color: #f0f0f0;
            font-family: Arial, sans-serif;
          }
  
          .resume-container1 {
            max-width: 850px;
            margin: 0 auto;
            background: #fff;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
  
          @media print {
            body {
              background-color: white;
            }
            .resume-container {
              box-shadow: none;
              padding: 0;
              border-radius: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="resume-container1">
          ${filledHTML}
        </div>
      </body>
      </html>
    `;

  return fullHTML;
}

async function generateDocxBuffer(templateName, resumeData) {
  const templatePath = path.join(__dirname, "../templates", `${templateName}.handlebars`);
  const rawTemplate = await fs.readFile(templatePath, "utf-8");
  const compiled = hbs.handlebars.compile(rawTemplate);
  const transformedData = transformResumeData(resumeData);
  const filledHTML = compiled(transformedData);

  const htmlWrapper = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Resume</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; }
        table { width: 100%; }
      </style>
    </head>
    <body>
      ${filledHTML}
    </body>
    </html>
  `;

  const docxBuffer = await htmlToDocx(htmlWrapper, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
  });

  return docxBuffer;
}

module.exports = {
  generatePdfBuffer,
  generateHtmlPreview,
  generateDocxBuffer,
};






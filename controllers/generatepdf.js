const puppeteer = require("puppeteer");
const { create } = require("express-handlebars");
const path = require("path");
const fs = require("fs/promises");
const moment = require("moment");
const htmlToDocx = require("html-to-docx");
const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");


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

async function generatePdfBuffer(templateName, resumeData, pageLimit = null) {
  const templatePath = path.join(__dirname, "../templates", `${templateName}.handlebars`);
  const rawTemplate = await fs.readFile(templatePath, "utf-8");
  const compiled = hbs.handlebars.compile(rawTemplate);
  const transformedData = transformResumeData(resumeData);
  let filledHTML = compiled(transformedData);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none",
      "--force-color-profile=srgb"],
  });

  const page = await browser.newPage();

  // Build PDF options
  const pdfOptions = {
    format: "A4",
    printBackground: true,
    margin: { top: "7mm", bottom: "5mm", left: "5mm", right: "5mm" },
  };

  // If pageLimit is specified, we need to compress content to fit
  if (pageLimit && pageLimit > 0) {
    // First, load content and measure actual page count
    await page.setContent(filledHTML, { waitUntil: "networkidle0" });

    // Calculate actual pages by measuring content height vs page height
    const metrics = await page.evaluate(() => {
      const bodyHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      // A4 page height at 96 DPI minus margins (approximately 1070px usable height)
      const a4HeightPx = 1123; // A4 height in pixels at standard web DPI
      const marginsPx = 53; // Combined top/bottom margins (7mm + 5mm ≈ 53px)
      const usableHeight = a4HeightPx - marginsPx;

      return {
        bodyHeight,
        usableHeight,
        estimatedPages: Math.ceil(bodyHeight / usableHeight)
      };
    });

    const actualPageCount = metrics.estimatedPages;

    // If actual pages exceed desired limit, apply compression
    if (actualPageCount > pageLimit) {
      // Calculate zoom factor to fit content within desired pages
      const zoomFactor = Math.sqrt(pageLimit / actualPageCount) * 0.95; // 0.95 for safety margin

      // Extract styles and body content from the original HTML
      const styleMatch = filledHTML.match(/<style>([\s\S]*?)<\/style>/);
      const bodyMatch = filledHTML.match(/<body>([\s\S]*?)<\/body>/);

      const originalStyles = styleMatch ? styleMatch[1] : '';
      const bodyContent = bodyMatch ? bodyMatch[1] : filledHTML;

      // For 1-page limit, use minimal padding and margins
      const containerPadding = pageLimit === 1 ? '0px' : '3px';
      const containerMaxWidth = pageLimit === 1 ? '100%' : '800px';

      // Adjust PDF margins for single page
      if (pageLimit === 1) {
        pdfOptions.margin = { top: "3mm", bottom: "3mm", left: "3mm", right: "3mm" };
      }

      // Wrap content with zoom and scaling, preserving original styles
      filledHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            * { box-sizing: border-box; }
            ${originalStyles}
            html {
              margin: 0 !important;
              padding: 0 !important;
              width: 100%;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100%;
              zoom: ${zoomFactor};
              -moz-transform: scale(${zoomFactor});
              -moz-transform-origin: 0 0;
            }
            .resume-container {
              padding: ${containerPadding} !important;
              margin: 0 auto !important;
              max-width: ${containerMaxWidth} !important;
              width: 100% !important;
            }
            hr {
              margin: 2px 0 !important;
            }
            .section-title {
              margin-bottom: 2px !important;
            }
            .experience-item, .education-item, .custom-section-block {
              margin-bottom: 4px !important;
            }
          </style>
        </head>
        <body>
          ${bodyContent}
        </body>
        </html>
      `;

      // Reload page with compressed content
      await page.setContent(filledHTML, { waitUntil: "networkidle0" });
    }
  } else {
    // No page limit, just set content normally
    await page.setContent(filledHTML, { waitUntil: "networkidle0" });
  }

  const pdfBuffer = await page.pdf(pdfOptions);

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

// OLD FUNCTION: Generate DOCX from HTML (using html-to-docx)
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

// Transform resume data for DOCX templates
const transformResumeDataForDocx = (data) => {
  const location = `${data.location?.city || ""} ${data.location?.city && data.location?.country ? "," : ""} ${data.location?.country || ""}`.trim();
  console.log(data.experience, "key achievements")
  return {
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    location: location,
    email: data.email || "",
    phoneNumber: data.phoneNumber || "",
    linkedin: data.linkedinProfile || "",
    appliedJobTitle: data.appliedJobTitle || "",
    summary: data.summary || "",

    experience: data.experience?.map((exp) => ({
      position: exp.position || "",
      companyName: exp.companyName || "",
      from: formatDateExp(exp.from, exp.to) || "",
      to: formatDateExp(exp.to) || "Present",
      keyAchievements: Array.isArray(exp.keyAchievements)
        ? exp.keyAchievements.filter(achievement => achievement && achievement.trim && achievement.trim() !== "")
        : [],
    })) || [],

    education: data.education?.map((ed) => ({
      degree: ed.degree || "",
      institution: ed.institution || "",
      from: formatDateExp(ed.from, ed.to, "education") || "",
      to: formatDateExp(ed.to, "", "education") || "",
      description: ed.description || "",
    })) || [],

    skills: data.skills?.map((s) => ({
      name: typeof s === 'string' ? s : (s.name || "")
    })) || [],

    customSections: data.customSections?.map((section) => ({
      title: section.title || "",
      items: section.items?.map((item) => ({
        name: item.name || "",
        location: item.location || "",
        startDate: formatDateExp(item.startDate, item.endDate) || "",
        endDate: formatDateExp(item.endDate) || "",
        description: item.description || "",
      })) || [],
    })) || [],
  };
};

// Compress DOCX content by modifying font sizes, spacing, and margins
function compressDocxContent(zip, pageLimit) {
  // Compression factors based on page limit
  let fontSizeMultiplier, spacingMultiplier, marginReduction;

  if (pageLimit === 1) {
    fontSizeMultiplier = 0.65;  // 65% of original font size
    spacingMultiplier = 0.50;   // 50% of original spacing
    marginReduction = 0.40;     // 40% of original margins
  } else if (pageLimit === 2) {
    fontSizeMultiplier = 0.80;  // 80% of original font size
    spacingMultiplier = 0.70;   // 70% of original spacing
    marginReduction = 0.65;     // 65% of original margins
  } else if (pageLimit === 3) {
    fontSizeMultiplier = 0.90;  // 90% of original font size
    spacingMultiplier = 0.80;   // 80% of original spacing
    marginReduction = 0.80;     // 80% of original margins
  } else {
    return; // No compression needed
  }

  try {
    // Modify document.xml (main content)
    const documentXml = zip.file('word/document.xml').asText();
    let modifiedDocXml = documentXml;

    // Reduce font sizes - <w:sz w:val="XX"/> and <w:szCs w:val="XX"/>
    modifiedDocXml = modifiedDocXml.replace(/<w:sz w:val="(\d+)"\/>/g, (match, size) => {
      const newSize = Math.max(14, Math.round(parseInt(size) * fontSizeMultiplier)); // Minimum 7pt (14 half-points)
      return `<w:sz w:val="${newSize}"/>`;
    });

    modifiedDocXml = modifiedDocXml.replace(/<w:szCs w:val="(\d+)"\/>/g, (match, size) => {
      const newSize = Math.max(14, Math.round(parseInt(size) * fontSizeMultiplier));
      return `<w:szCs w:val="${newSize}"/>`;
    });

    // Reduce spacing before and after paragraphs
    modifiedDocXml = modifiedDocXml.replace(/<w:spacing([^>]*?)w:before="(\d+)"([^>]*?)>/g, (match, before, spacing, after) => {
      const newSpacing = Math.round(parseInt(spacing) * spacingMultiplier);
      return `<w:spacing${before}w:before="${newSpacing}"${after}>`;
    });

    modifiedDocXml = modifiedDocXml.replace(/<w:spacing([^>]*?)w:after="(\d+)"([^>]*?)>/g, (match, before, spacing, after) => {
      const newSpacing = Math.round(parseInt(spacing) * spacingMultiplier);
      return `<w:spacing${before}w:after="${newSpacing}"${after}>`;
    });

    // Reduce line spacing
    modifiedDocXml = modifiedDocXml.replace(/<w:spacing([^>]*?)w:line="(\d+)"([^>]*?)>/g, (match, before, spacing, after) => {
      const newSpacing = Math.round(parseInt(spacing) * spacingMultiplier);
      return `<w:spacing${before}w:line="${newSpacing}"${after}>`;
    });

    // Reduce page margins - handle multiple w:pgMar patterns
    modifiedDocXml = modifiedDocXml.replace(
      /<w:pgMar([^>]*?)\/>/g,
      (match, attributes) => {
        let newAttributes = attributes;

        // Replace each margin attribute
        newAttributes = newAttributes.replace(/w:top="(\d+)"/g, (m, val) => {
          return `w:top="${Math.round(parseInt(val) * marginReduction)}"`;
        });
        newAttributes = newAttributes.replace(/w:right="(\d+)"/g, (m, val) => {
          return `w:right="${Math.round(parseInt(val) * marginReduction)}"`;
        });
        newAttributes = newAttributes.replace(/w:bottom="(\d+)"/g, (m, val) => {
          return `w:bottom="${Math.round(parseInt(val) * marginReduction)}"`;
        });
        newAttributes = newAttributes.replace(/w:left="(\d+)"/g, (m, val) => {
          return `w:left="${Math.round(parseInt(val) * marginReduction)}"`;
        });

        return `<w:pgMar${newAttributes}/>`;
      }
    );

    // Update the document.xml in the zip using PizZip's file() method
    zip.file('word/document.xml', modifiedDocXml);

    // Modify styles.xml to reduce default styles
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      const stylesXml = stylesFile.asText();
      let modifiedStylesXml = stylesXml;

      // Reduce font sizes in styles
      modifiedStylesXml = modifiedStylesXml.replace(/<w:sz w:val="(\d+)"\/>/g, (match, size) => {
        const newSize = Math.max(14, Math.round(parseInt(size) * fontSizeMultiplier));
        return `<w:sz w:val="${newSize}"/>`;
      });

      modifiedStylesXml = modifiedStylesXml.replace(/<w:szCs w:val="(\d+)"\/>/g, (match, size) => {
        const newSize = Math.max(14, Math.round(parseInt(size) * fontSizeMultiplier));
        return `<w:szCs w:val="${newSize}"/>`;
      });

      // Reduce spacing in styles
      modifiedStylesXml = modifiedStylesXml.replace(/<w:spacing([^>]*?)w:before="(\d+)"([^>]*?)>/g, (match, before, spacing, after) => {
        const newSpacing = Math.round(parseInt(spacing) * spacingMultiplier);
        return `<w:spacing${before}w:before="${newSpacing}"${after}>`;
      });

      modifiedStylesXml = modifiedStylesXml.replace(/<w:spacing([^>]*?)w:after="(\d+)"([^>]*?)>/g, (match, before, spacing, after) => {
        const newSpacing = Math.round(parseInt(spacing) * spacingMultiplier);
        return `<w:spacing${before}w:after="${newSpacing}"${after}>`;
      });

      modifiedStylesXml = modifiedStylesXml.replace(/<w:spacing([^>]*?)w:line="(\d+)"([^>]*?)>/g, (match, before, spacing, after) => {
        const newSpacing = Math.round(parseInt(spacing) * spacingMultiplier);
        return `<w:spacing${before}w:line="${newSpacing}"${after}>`;
      });

      // Update the styles.xml in the zip
      zip.file('word/styles.xml', modifiedStylesXml);
    }

    console.log(`DOCX compressed for page limit: ${pageLimit}`);
  } catch (error) {
    console.error('Error compressing DOCX content:', error);
    throw error;
  }
}

// NEW FUNCTION: Generate DOCX from .docx template (using docxtemplater)
async function generateDocxFromTemplate(templateName, resumeData, pageLimit = null) {
  // Use .docx template file
  const templatePath = path.join(__dirname, "../templates", `${templateName}.docx`);

  // Read the template file as binary
  const content = await fs.readFile(templatePath, 'binary');

  // Load the docx file as binary content
  const zip = new PizZip(content);

  // Create a docxtemplater instance
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Transform the data for DOCX template
  const transformedData = transformResumeDataForDocx(resumeData);
  console.log(transformedData?.experience, "transformed data for docx")
  // Set the template data
  doc.render(transformedData);

  // Get the zip after rendering
  const generatedZip = doc.getZip();

  // Apply compression if pageLimit is specified
  if (pageLimit && pageLimit > 0 && pageLimit <= 3) {
    compressDocxContent(generatedZip, pageLimit);
  }

  // Generate the docx buffer
  const buffer = generatedZip.generate({
    type: 'nodebuffer',
    compression: "DEFLATE",
  });

  return buffer;
}

module.exports = {
  generatePdfBuffer,
  generateHtmlPreview,
  generateDocxBuffer,
  generateDocxFromTemplate,
};



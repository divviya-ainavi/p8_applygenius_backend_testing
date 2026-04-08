const axios = require('axios');

function extractJSON(text) {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    const jsonString = text.slice(jsonStart, jsonEnd + 1);
    try {
      return JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON in response');
    }
  }
  throw new Error('No valid JSON found in response');
}


exports.parseResume = async (req, res) => {
  const { resume: resumeText, appliedJobTitle } = req.body;
  if (!resumeText) return res.status(400).json({ error: 'Resume text is required' });
  // console.log(process.env.OPENAI_API_KEY, "open api key")
  try {
    const generalPrompt = {
      model: 'gpt-4.1-mini',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `Extract structured information from the resume text and return ONLY valid raw JSON (no markdown, no code block).

{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phoneNumber": "",
  "linkedinProfile": "",
  "location": { "address": "", "city": "", "country": "", "postcode": "" },
  "blog": "",
  "portfolio": "",
  "currentPosition": "",
  "summary": "",
  "skills": [],
  "education": [{
    "degree": "",
    "institution": "",
    "from": "",
    "to": "",
    "city": "",
    "region": "",
    "description": ""
  }],
  "certifications": [{
    "title": "",
    "from": "",
    "to": "",
    "institution": "",
    "description": ""
  }],
  "projects": [{
    "title": "",
    "year": "",
    "description": ""
  }],
  "communication": "",
  "leadership": "",
  "references": "",
  "awardsandAcknowledgements": [],
  "interests": [],
  "achievements": [""],
  "others": [{ "title": "", "content": "" }]
}

Rules:
- Extract all clear quantifiable results or notable accomplishments into "achievements".
- For "others", include every extra section or unique heading not matching the above fields.
- Split multiple items into separate objects, e.g.:
  "others": [
    {"title": "Board Member", "content": "Served on International Advisory Board..."},
  ]
- Keep "title" short and "content" descriptive.
- Leave fields empty if not found.

Resume Text:
${resumeText}`
        }
      ]
    }

    const experiencePrompt = {
      model: 'gpt-4.1-mini',
      temperature: 0,
      // max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Extract detailed work experience from the resume below. For each job, include:
    
    - Start and end dates
    - Company name
    - Position title
    - Responsibilities (return as an array of bullet points, without bullet symbols or newline characters)
    
    Return a JSON object with the following format:
    
    {
      "experience": [
        {
          "from": "Start date",
          "to": "End date or Present",
          "companyName": "Company name",
          "position": "Job title",
          "responsibilities": ["Responsibility 1", "Responsibility 2", "Responsibility 3"]
        }
      ]
    }
    
    Only return valid JSON. Do not include explanations or markdown formatting.
    
    Resume Text:
    ${resumeText}`
        }
      ]
    };

    const skillsProfilePrompt = {
      model: 'gpt-4.1-mini',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `Extract a structured skills profile from the resume. For each skill, infer the proficiency level from how it was used and include context.

Return ONLY valid raw JSON (no markdown, no code block):

{
  "skills_profile": [
    {
      "name": "skill name",
      "proficiency": "Beginner|Intermediate|Advanced|Expert",
      "company": "company name where skill was used (most recent)",
      "role": "job title where skill was used",
      "duration": "approximate duration e.g. 2 years",
      "source": "extracted"
    }
  ]
}

Rules:
- Include all technical and soft skills evident from the resume.
- Infer proficiency from context (e.g. "led", "architected" = Expert; "assisted" = Beginner).
- If a skill appears in multiple jobs, use the most recent company/role.
- Leave company/role/duration empty strings if not determinable.

Resume Text:
${resumeText}`
        }
      ]
    };

    const headers = {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    // 🔁 Run all three requests in parallel
    const [generalResponse, experienceResponse, skillsProfileResponse] = await Promise.all([
      axios.post('https://api.openai.com/v1/chat/completions', generalPrompt, headers),
      axios.post('https://api.openai.com/v1/chat/completions', experiencePrompt, headers),
      axios.post('https://api.openai.com/v1/chat/completions', skillsProfilePrompt, headers)
    ]);
    // console.log(generalResponse.data.choices[0].message.content, "generalResponse.data.choices[0].message.content")
    // console.log(experienceResponse.data.choices[0].message.content, "experienceResponse.data.choices[0].message.content")
    const generalData = extractJSON(generalResponse.data.choices[0].message.content);
    const experienceData = extractJSON(experienceResponse.data.choices[0].message.content);
    const skillsProfileData = extractJSON(skillsProfileResponse.data.choices[0].message.content);

    const finalResult = {
      ...generalData,
      ...experienceData,
      skills_profile: skillsProfileData.skills_profile || [],
      appliedJobTitle: appliedJobTitle || ""
    };

    res.json(finalResult);

  } catch (error) {
    console.error('Error parsing resume:', error.message);
    res.status(500).json({ error: 'Failed to parse resume' });
  }
};
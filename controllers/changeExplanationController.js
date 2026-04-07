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

exports.explainChanges = async (req, res) => {
  const { originalData, tailoredData } = req.body;
  if (!originalData || !tailoredData) {
    return res.status(400).json({ error: 'originalData and tailoredData are required' });
  }

  try {
    const prompt = {
      model: 'gpt-4.1-mini',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `You are a resume optimization expert. Analyze the changes between the original and AI-tailored resume sections. For each changed section provide a concise explanation of WHY the change improves the resume and what ATS/keyword improvements it introduces.

Original Summary: ${originalData.summary || ''}
Tailored Summary: ${tailoredData.Tsummary || ''}

Original Experience (first 3): ${JSON.stringify((originalData.experience || []).slice(0, 3))}
Tailored Experience (first 3): ${JSON.stringify((tailoredData.Texperience || []).slice(0, 3))}

Original Skills: ${JSON.stringify((originalData.skills || []).slice(0, 20))}
Tailored Skills: ${JSON.stringify((tailoredData.Tskills || []).slice(0, 20))}

Original Education: ${JSON.stringify(originalData.education || [])}
Tailored Education: ${JSON.stringify(tailoredData.Teducation || [])}

Return ONLY valid raw JSON (no markdown, no code block) in this exact format:
{
  "summary": "one-sentence explanation of summary change",
  "summaryTags": ["ATS keyword improved", "quantified impact added"],
  "experience": [
    {
      "position": "explanation for position title change or empty string",
      "positionTags": ["tag1"],
      "responsibilities": ["explanation for bullet 0", "explanation for bullet 1", "explanation for bullet 2"]
    }
  ],
  "skills": ["explanation for skill 0 change or empty string"],
  "education": [
    {
      "degree": "explanation or empty string",
      "description": "explanation or empty string"
    }
  ]
}`
        }
      ]
    };

    const headers = {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      prompt,
      headers
    );

    const parsed = extractJSON(response.data.choices[0].message.content);

    // Flatten into changeKey-indexed format for easy frontend consumption
    const result = {};

    if (parsed.summary) result.summary = parsed.summary;
    if (parsed.summaryTags) result.summaryTags = parsed.summaryTags;

    (parsed.experience || []).forEach((exp, i) => {
      if (exp.position) result[`experience_${i}_position`] = exp.position;
      if (exp.positionTags) result[`experience_${i}_positionTags`] = exp.positionTags;
      (exp.responsibilities || []).forEach((r, idx) => {
        if (r) result[`experience_${i}_responsibility_${idx}`] = r;
      });
    });

    (parsed.skills || []).forEach((s, i) => {
      if (s) result[`skill_${i}`] = s;
    });

    (parsed.education || []).forEach((edu, i) => {
      if (edu.degree) result[`education_${i}_degree`] = edu.degree;
      if (edu.description) result[`education_${i}_description`] = edu.description;
    });

    res.json(result);
  } catch (error) {
    console.error('Error explaining changes:', error.message);
    res.status(500).json({ error: 'Failed to explain changes' });
  }
};

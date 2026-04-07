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
  const { original, tailored } = req.body;
  if (!original || !tailored) {
    return res.status(400).json({ error: 'Original and tailored resume data are required' });
  }

  try {
    const prompt = {
      model: 'gpt-4.1-mini',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `You are a resume optimization expert. Analyze the differences between an original and AI-tailored resume and explain each change concisely.

Original Summary: ${original.summary || ''}
Tailored Summary: ${tailored.Tsummary || ''}

Original Experience (first job, first 3 responsibilities): ${JSON.stringify(original.experience?.[0]?.responsibilities?.slice(0, 3) || [])}
Tailored Experience (first job, first 3 responsibilities): ${JSON.stringify((tailored.Texperience?.[0]?.keyAchievements || tailored.Texperience?.[0]?.responsibilities)?.slice(0, 3) || [])}

Original Skills (first 5): ${JSON.stringify((original.skills || []).slice(0, 5))}
Tailored Skills (first 5): ${JSON.stringify((tailored.Tskills || []).slice(0, 5))}

Return ONLY valid JSON (no markdown, no code block):
{
  "summary": {
    "explanation": "Why the summary was changed to better match the job",
    "atsImpact": "How this improves ATS scoring",
    "keywords": ["keyword1", "keyword2"]
  },
  "experience": {
    "overall": "General explanation of experience changes",
    "atsImpact": "How these changes improve ATS scoring",
    "keywords": ["keyword1", "keyword2"]
  },
  "skills": {
    "explanation": "Why skills were updated or reordered",
    "atsImpact": "How skill changes improve ATS keyword matching",
    "keywords": ["keyword1", "keyword2"]
  },
  "education": {
    "explanation": "Why education section was updated if at all",
    "atsImpact": "How education changes improve the application"
  }
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

    const response = await axios.post('https://api.openai.com/v1/chat/completions', prompt, headers);
    const explanations = extractJSON(response.data.choices[0].message.content);

    res.json(explanations);
  } catch (error) {
    console.error('Error generating change explanations:', error.message);
    res.status(500).json({ error: 'Failed to generate change explanations' });
  }
};

const axios = require('axios');

// In-memory store as a placeholder; swap for real MongoDB client when ready
// Expected MongoDB collection: skills_profiles
// Document shape: { userId, skills: [{ _id, skill, proficiency, company, role, duration }] }

const getMongoClient = () => {
  // Return a MongoDB client configured via env vars
  // This is a stub — wire up with your existing MongoDB connection
  throw new Error('MongoDB client not configured. Set MONGODB_URI and connect via mongoose or native driver.');
};

// GET /skills/profile?userId=xxx
exports.getSkillsProfile = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Stub: replace with actual DB query
    // const profile = await SkillsProfile.findOne({ userId });
    // return res.json(profile || { userId, skills: [] });
    res.json({ userId, skills: [] });
  } catch (err) {
    console.error('getSkillsProfile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch skills profile' });
  }
};

// POST /skills
exports.addSkill = async (req, res) => {
  try {
    const { userId, skill, proficiency = 'Intermediate', company = '', role = '', duration = '' } = req.body;
    if (!userId || !skill) return res.status(400).json({ error: 'userId and skill are required' });

    const newSkill = {
      _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      skill,
      proficiency,
      company,
      role,
      duration,
      createdAt: new Date().toISOString(),
    };

    // Stub: replace with actual upsert
    // await SkillsProfile.findOneAndUpdate(
    //   { userId },
    //   { $push: { skills: newSkill } },
    //   { upsert: true, new: true }
    // );

    res.status(201).json(newSkill);
  } catch (err) {
    console.error('addSkill error:', err.message);
    res.status(500).json({ error: 'Failed to add skill' });
  }
};

// PUT /skills/:id
exports.updateSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { proficiency } = req.body;
    if (!proficiency) return res.status(400).json({ error: 'proficiency is required' });

    // Stub: replace with actual update
    // await SkillsProfile.findOneAndUpdate(
    //   { 'skills._id': id },
    //   { $set: { 'skills.$.proficiency': proficiency } }
    // );

    res.json({ _id: id, proficiency });
  } catch (err) {
    console.error('updateSkill error:', err.message);
    res.status(500).json({ error: 'Failed to update skill' });
  }
};

// DELETE /skills/:id
exports.deleteSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Stub: replace with actual pull
    // await SkillsProfile.findOneAndUpdate(
    //   { userId },
    //   { $pull: { skills: { _id: id } } }
    // );

    res.json({ deleted: id });
  } catch (err) {
    console.error('deleteSkill error:', err.message);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
};

// POST /skills/relevance-score
exports.getRelevanceScore = async (req, res) => {
  try {
    const { userId, jobDescription } = req.body;
    if (!userId || !jobDescription) {
      return res.status(400).json({ error: 'userId and jobDescription are required' });
    }

    // Stub: fetch user skills from DB
    // const profile = await SkillsProfile.findOne({ userId });
    // const userSkills = profile?.skills?.map(s => s.skill) || [];
    const userSkills = [];

    const prompt = {
      model: 'gpt-4.1-mini',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `You are a career coach. Given the user's skills list and a job description, calculate a relevance match score and identify skill gaps.

User Skills: ${JSON.stringify(userSkills)}

Job Description:
${jobDescription}

Return ONLY valid raw JSON (no markdown):
{
  "matchScore": <number 0-100>,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3", "skill4"],
  "learningResources": [
    { "skill": "skill3", "title": "Course or resource title", "url": "" }
  ]
}`,
        },
      ],
    };

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      prompt,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const raw = response.data.choices[0].message.content;
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const result = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    res.json(result);
  } catch (err) {
    console.error('getRelevanceScore error:', err.message);
    res.status(500).json({ error: 'Failed to calculate relevance score' });
  }
};

// POST /skills/gap-analysis
exports.getGapAnalysis = async (req, res) => {
  try {
    const { userId, jobDescription } = req.body;
    if (!userId || !jobDescription) {
      return res.status(400).json({ error: 'userId and jobDescription are required' });
    }

    // Re-use relevance score logic
    req.body = { userId, jobDescription };
    return exports.getRelevanceScore(req, res);
  } catch (err) {
    console.error('getGapAnalysis error:', err.message);
    res.status(500).json({ error: 'Failed to run gap analysis' });
  }
};

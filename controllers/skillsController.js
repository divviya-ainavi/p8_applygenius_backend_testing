const axios = require("axios");
const { MongoClient, ObjectId } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "applygenius";
const COLLECTION = "skills_profiles";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function getDb() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  return { client, db: client.db(DB_NAME) };
}

// GET /skills/skills-profile?userId=xxx
exports.getSkillsProfile = async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  let client;
  try {
    const conn = await getDb();
    client = conn.client;
    const profile = await conn.db
      .collection(COLLECTION)
      .findOne({ userId });
    res.json(profile || { userId, skills: [] });
  } catch (err) {
    console.error("getSkillsProfile error:", err.message);
    res.status(500).json({ error: "Failed to fetch skills profile" });
  } finally {
    if (client) await client.close();
  }
};

// POST /skills/
exports.addSkill = async (req, res) => {
  const { userId, skill } = req.body;
  if (!userId || !skill) return res.status(400).json({ error: "userId and skill are required" });

  const newSkill = {
    _id: new ObjectId().toString(),
    name: skill.name,
    proficiency: skill.proficiency || "Intermediate",
    company: skill.company || "",
    role: skill.role || "",
    duration: skill.duration || "",
    source: skill.source || "manual",
    addedAt: new Date().toISOString(),
  };

  let client;
  try {
    const conn = await getDb();
    client = conn.client;
    await conn.db.collection(COLLECTION).updateOne(
      { userId },
      { $push: { skills: newSkill }, $setOnInsert: { userId } },
      { upsert: true }
    );
    res.json({ success: true, skill: newSkill });
  } catch (err) {
    console.error("addSkill error:", err.message);
    res.status(500).json({ error: "Failed to add skill" });
  } finally {
    if (client) await client.close();
  }
};

// PUT /skills/:id
exports.updateSkill = async (req, res) => {
  const { id } = req.params;
  const { proficiency, userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  let client;
  try {
    const conn = await getDb();
    client = conn.client;
    await conn.db.collection(COLLECTION).updateOne(
      { userId, "skills._id": id },
      { $set: { "skills.$.proficiency": proficiency } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("updateSkill error:", err.message);
    res.status(500).json({ error: "Failed to update skill" });
  } finally {
    if (client) await client.close();
  }
};

// DELETE /skills/:id
exports.deleteSkill = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  let client;
  try {
    const conn = await getDb();
    client = conn.client;
    await conn.db.collection(COLLECTION).updateOne(
      { userId },
      { $pull: { skills: { _id: id } } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("deleteSkill error:", err.message);
    res.status(500).json({ error: "Failed to delete skill" });
  } finally {
    if (client) await client.close();
  }
};

// POST /skills/relevance-score
exports.calculateRelevanceScore = async (req, res) => {
  const { userId, applicationId, jobDescription } = req.body;
  if (!userId || !jobDescription)
    return res.status(400).json({ error: "userId and jobDescription are required" });

  let client;
  try {
    const conn = await getDb();
    client = conn.client;
    const profile = await conn.db.collection(COLLECTION).findOne({ userId });
    const skills = profile?.skills || [];

    if (skills.length === 0) {
      return res.json({ score: 0, matchedSkills: [], missingSkills: [], gaps: [] });
    }

    const skillsList = skills.map((s) => s.name).join(", ");

    const prompt = {
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are a job matching expert. Given the user's skills and a job description, calculate a match score and identify gaps.

User Skills: ${skillsList}

Job Description:
${jobDescription}

Return ONLY valid JSON (no markdown):
{
  "score": <0-100 integer>,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3", "skill4"],
  "gaps": [
    {
      "skill": "skill name",
      "importance": "high|medium|low",
      "learningResources": [
        { "title": "Resource title", "url": "https://example.com", "type": "course|article|video" }
      ]
    }
  ]
}`,
        },
      ],
    };

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      prompt,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content;
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    const result = JSON.parse(content.slice(jsonStart, jsonEnd + 1));

    // Persist score to MongoDB if applicationId provided
    if (applicationId) {
      await conn.db.collection(COLLECTION).updateOne(
        { userId },
        {
          $set: {
            [`relevanceScores.${applicationId}`]: {
              score: result.score,
              matchedSkills: result.matchedSkills,
              missingSkills: result.missingSkills,
              calculatedAt: new Date().toISOString(),
            },
          },
        },
        { upsert: true }
      );
    }

    res.json(result);
  } catch (err) {
    console.error("calculateRelevanceScore error:", err.message);
    res.status(500).json({ error: "Failed to calculate relevance score" });
  } finally {
    if (client) await client.close();
  }
};

// POST /skills/gap-analysis
exports.getGapAnalysis = async (req, res) => {
  const { userId, applicationId, jobDescription } = req.body;
  if (!userId || !jobDescription)
    return res.status(400).json({ error: "userId and jobDescription are required" });

  let client;
  try {
    const conn = await getDb();
    client = conn.client;
    const profile = await conn.db.collection(COLLECTION).findOne({ userId });
    const skills = profile?.skills || [];
    const skillsList = skills.map((s) => s.name).join(", ");

    const prompt = {
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Analyze skill gaps between the user's skills and job requirements.

User Skills: ${skillsList || "none"}

Job Description:
${jobDescription}

Return ONLY valid JSON (no markdown):
{
  "gaps": [
    {
      "skill": "skill name",
      "importance": "high|medium|low",
      "description": "Why this skill matters for the role",
      "learningResources": [
        { "title": "Resource title", "url": "https://example.com", "type": "course|article|video" }
      ]
    }
  ],
  "strengths": ["skill that matches well"],
  "overallReadiness": "high|medium|low"
}`,
        },
      ],
    };

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      prompt,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content;
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    const result = JSON.parse(content.slice(jsonStart, jsonEnd + 1));

    res.json(result);
  } catch (err) {
    console.error("getGapAnalysis error:", err.message);
    res.status(500).json({ error: "Failed to get gap analysis" });
  } finally {
    if (client) await client.close();
  }
};

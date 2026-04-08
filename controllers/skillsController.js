const axios = require("axios");

const N8N_BASE_URL =
  process.env.N8N_BASE_URL || "https://n8napp.applygenius.ai/webhook";

const extractSkills = async (req, res) => {
  try {
    const { cvText, userId } = req.body;
    const response = await axios.post(`${N8N_BASE_URL}/skills-extract`, {
      cvText,
      userId,
    });
    res.json(response.data);
  } catch (error) {
    console.error("extractSkills error:", error.message);
    res.status(500).json({ error: "Failed to extract skills" });
  }
};

const getSkillsProfile = async (req, res) => {
  try {
    const { userId } = req.query;
    const response = await axios.get(`${N8N_BASE_URL}/skills-profile`, {
      params: { userId },
    });
    res.json(response.data);
  } catch (error) {
    console.error("getSkillsProfile error:", error.message);
    res.status(500).json({ error: "Failed to fetch skills profile" });
  }
};

const updateSkills = async (req, res) => {
  try {
    const { userId, skills } = req.body;
    const response = await axios.post(`${N8N_BASE_URL}/skills-update`, {
      userId,
      skills,
    });
    res.json(response.data);
  } catch (error) {
    console.error("updateSkills error:", error.message);
    res.status(500).json({ error: "Failed to update skills" });
  }
};

const calculateFitScore = async (req, res) => {
  try {
    const { userId, jobDescription } = req.body;
    const response = await axios.post(`${N8N_BASE_URL}/skills-fit-score`, {
      userId,
      jobDescription,
    });
    res.json(response.data);
  } catch (error) {
    console.error("calculateFitScore error:", error.message);
    res.status(500).json({ error: "Failed to calculate fit score" });
  }
};

module.exports = { extractSkills, getSkillsProfile, updateSkills, calculateFitScore };

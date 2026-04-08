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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};

const updateSkills = async (req, res) => {
  try {
    const { userId, skills } = req.body;
    const response = await axios.put(`${N8N_BASE_URL}/skills-update`, {
      userId,
      skills,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};

module.exports = { extractSkills, getSkillsProfile, updateSkills, calculateFitScore };

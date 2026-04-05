const axios = require('axios');
const SkillsGraph = require('../models/SkillsGraph');

const N8N_BASE = process.env.N8N_BASE_URL || 'https://n8napp.applygenius.ai/webhook';

/**
 * POST /api/skills/extract
 * Body: { cvText: string, userId: string }
 * Calls the n8n Skills-Extractor workflow, stores result to Firebase,
 * and returns the skills graph.
 */
exports.extractSkillsFromResume = async (req, res) => {
  const { cvText, userId } = req.body;
  if (!cvText || !userId) {
    return res.status(400).json({ error: 'cvText and userId are required' });
  }
  try {
    const n8nRes = await axios.post(`${N8N_BASE}/skills-extractor`, {
      cvText,
      userId,
    });
    const graph = n8nRes.data || { nodes: [], edges: [] };
    return res.json(graph);
  } catch (err) {
    console.error('Skills extraction error:', err.message);
    return res.status(500).json({ error: 'Failed to extract skills' });
  }
};

/**
 * GET /api/skills/:userId
 * Returns the skills graph for the given user from Firebase.
 */
exports.getSkillsGraph = async (req, res) => {
  const { userId } = req.params;
  try {
    const graph = await SkillsGraph.get(userId);
    return res.json(graph);
  } catch (err) {
    console.error('Get skills graph error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve skills graph' });
  }
};

/**
 * POST /api/skills/:userId/node
 * Body: skill node object
 * Adds a new skill node to the user's graph.
 */
exports.addSkillNode = async (req, res) => {
  const { userId } = req.params;
  const nodeData = req.body;
  if (!nodeData || !nodeData.name) {
    return res.status(400).json({ error: 'Skill node with a name is required' });
  }
  try {
    const graph = await SkillsGraph.addNode(userId, nodeData);
    return res.json(graph);
  } catch (err) {
    console.error('Add skill node error:', err.message);
    return res.status(500).json({ error: 'Failed to add skill node' });
  }
};

/**
 * PUT /api/skills/:userId/node/:skillId
 * Body: partial skill node fields to update
 */
exports.updateSkillNode = async (req, res) => {
  const { userId, skillId } = req.params;
  const nodeData = req.body;
  try {
    const graph = await SkillsGraph.updateNode(userId, skillId, nodeData);
    return res.json(graph);
  } catch (err) {
    console.error('Update skill node error:', err.message);
    return res.status(500).json({ error: 'Failed to update skill node' });
  }
};

/**
 * DELETE /api/skills/:userId/node/:skillId
 */
exports.deleteSkillNode = async (req, res) => {
  const { userId, skillId } = req.params;
  try {
    const graph = await SkillsGraph.deleteNode(userId, skillId);
    return res.json(graph);
  } catch (err) {
    console.error('Delete skill node error:', err.message);
    return res.status(500).json({ error: 'Failed to delete skill node' });
  }
};

/**
 * POST /api/skills/match
 * Body: { userId, jobDescription }
 * Computes a job match score using graph distance from the user's skills.
 */
exports.matchSkillsToJob = async (req, res) => {
  const { userId, jobDescription } = req.body;
  if (!userId || !jobDescription) {
    return res.status(400).json({ error: 'userId and jobDescription are required' });
  }
  try {
    const graph = await SkillsGraph.get(userId);
    const n8nRes = await axios.post(`${N8N_BASE}/skills-match`, {
      userId,
      jobDescription,
      graph,
    });
    return res.json(n8nRes.data);
  } catch (err) {
    console.error('Skills match error:', err.message);
    return res.status(500).json({ error: 'Failed to match skills to job' });
  }
};

/**
 * POST /api/skills/gap-analysis
 * Body: { jobDescription, skillNodes, skillEdges }
 * Returns matched skills, missing skills, and recommendations.
 */
exports.gapAnalysis = async (req, res) => {
  const { jobDescription, skillNodes, skillEdges } = req.body;
  if (!jobDescription) {
    return res.status(400).json({ error: 'jobDescription is required' });
  }
  try {
    const n8nRes = await axios.post(`${N8N_BASE}/skills-gap-analysis`, {
      jobDescription,
      skillNodes: skillNodes || [],
      skillEdges: skillEdges || [],
    });
    return res.json(n8nRes.data);
  } catch (err) {
    console.error('Gap analysis error:', err.message);
    return res.status(500).json({ error: 'Failed to run gap analysis' });
  }
};

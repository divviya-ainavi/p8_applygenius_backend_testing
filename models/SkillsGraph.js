const axios = require('axios');

const N8N_BASE = process.env.N8N_BASE_URL || 'https://n8napp.applygenius.ai/webhook';

/**
 * skillNode schema:
 * {
 *   id: string,
 *   name: string,
 *   category: string,
 *   proficiency: number (0-4),
 *   contexts: [{ company, jobTitle, durationMonths, description }],
 *   relationships: [{ targetSkillId, relationshipType }]
 * }
 *
 * Firebase path: skillsGraphs/{userId}
 * { nodes: skillNode[], edges: [{ source, target, relationshipType }] }
 */

const SkillsGraph = {
  async get(userId) {
    const res = await axios.get(`${N8N_BASE}/skills-graph-get`, {
      params: { userId },
    });
    return res.data || { nodes: [], edges: [] };
  },

  async save(userId, graph) {
    const res = await axios.post(`${N8N_BASE}/skills-graph-save`, {
      userId,
      graph,
    });
    return res.data;
  },

  async updateNode(userId, skillId, nodeData) {
    const graph = await SkillsGraph.get(userId);
    const idx = graph.nodes.findIndex((n) => n.id === skillId);
    if (idx !== -1) {
      graph.nodes[idx] = { ...graph.nodes[idx], ...nodeData };
    }
    await SkillsGraph.save(userId, graph);
    return graph;
  },

  async addNode(userId, nodeData) {
    const graph = await SkillsGraph.get(userId);
    graph.nodes.push(nodeData);
    await SkillsGraph.save(userId, graph);
    return graph;
  },

  async deleteNode(userId, skillId) {
    const graph = await SkillsGraph.get(userId);
    graph.nodes = graph.nodes.filter((n) => n.id !== skillId);
    graph.edges = (graph.edges || []).filter(
      (e) => e.source !== skillId && e.target !== skillId
    );
    await SkillsGraph.save(userId, graph);
    return graph;
  },
};

module.exports = SkillsGraph;

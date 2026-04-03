const axios = require('axios');

const N8N_WEBHOOK_BASE =
  process.env.N8N_WEBHOOK_URL || 'https://p8testing.ainavi.co.uk/webhook/';

exports.extractKeywords = async (req, res) => {
  const { jobDescription } = req.body;

  if (!jobDescription || !jobDescription.trim()) {
    return res.status(400).json({ error: 'jobDescription is required' });
  }

  try {
    const response = await axios.post(`${N8N_WEBHOOK_BASE}extract-keywords`, {
      jobDescription: jobDescription.trim(),
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error extracting keywords:', error.message);
    res.status(500).json({ error: 'Failed to extract keywords' });
  }
};

exports.saveCorrections = async (req, res) => {
  const { corrections, jobDescription } = req.body;

  if (!corrections) {
    return res.status(400).json({ error: 'corrections is required' });
  }

  try {
    const response = await axios.post(`${N8N_WEBHOOK_BASE}save-keyword-corrections`, {
      corrections,
      jobDescription: jobDescription || '',
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error saving keyword corrections:', error.message);
    res.status(500).json({ error: 'Failed to save corrections' });
  }
};

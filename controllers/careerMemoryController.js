const admin = require('firebase-admin');

function getDb() {
  return admin.firestore();
}

const getMemory = async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const db = getDb();
    const doc = await db.collection('careerMemory').doc(userId).get();
    if (!doc.exists) {
      return res.json({ preferences: {}, tonePreference: 2, editHistory: [] });
    }
    return res.json(doc.data());
  } catch (err) {
    console.error('getMemory error:', err.message);
    res.status(500).json({ error: 'Failed to fetch career memory' });
  }
};

const saveEdits = async (req, res) => {
  const { userId, section, original, edited, timestamp } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const db = getDb();
    const ref = db.collection('careerMemory').doc(userId);
    const doc = await ref.get();
    const existing = doc.exists ? doc.data() : {};

    const editEntry = {
      section: section || 'general',
      original: original || '',
      edited: edited || '',
      timestamp: timestamp || new Date().toISOString(),
    };

    const editHistory = [...(existing.editHistory || []), editEntry].slice(-100);

    // Derive simple preference signal from edit
    const updatedPreferences = { ...(existing.preferences || {}) };
    if (section && edited) {
      updatedPreferences[`preferred_${section}`] = edited;
    }

    await ref.set(
      { editHistory, preferences: updatedPreferences },
      { merge: true }
    );

    return res.json({ success: true, preferences: updatedPreferences, editHistory });
  } catch (err) {
    console.error('saveEdits error:', err.message);
    res.status(500).json({ error: 'Failed to save edits' });
  }
};

const updatePreferences = async (req, res) => {
  const { userId, id, value } = req.body;
  if (!userId || !id) return res.status(400).json({ error: 'userId and id are required' });

  try {
    const db = getDb();
    const ref = db.collection('careerMemory').doc(userId);
    const doc = await ref.get();
    const existing = doc.exists ? doc.data() : {};

    const preferences = { ...(existing.preferences || {}), [id]: value };
    await ref.set({ preferences }, { merge: true });

    return res.json({ success: true, preferences });
  } catch (err) {
    console.error('updatePreferences error:', err.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};

const deletePreference = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId || !id) return res.status(400).json({ error: 'userId and id are required' });

  try {
    const db = getDb();
    const ref = db.collection('careerMemory').doc(userId);
    const doc = await ref.get();
    if (!doc.exists) return res.json({ success: true, preferences: {} });

    const preferences = { ...(doc.data().preferences || {}) };
    delete preferences[id];

    await ref.set({ preferences }, { merge: true });
    return res.json({ success: true, preferences });
  } catch (err) {
    console.error('deletePreference error:', err.message);
    res.status(500).json({ error: 'Failed to delete preference' });
  }
};

const getImprovementStats = async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const db = getDb();
    const doc = await db.collection('careerMemory').doc(userId).get();
    if (!doc.exists) return res.json([]);

    const stats = doc.data()?.improvementStats || [];
    return res.json(stats);
  } catch (err) {
    console.error('getImprovementStats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch improvement stats' });
  }
};

module.exports = {
  getMemory,
  saveEdits,
  updatePreferences,
  deletePreference,
  getImprovementStats,
};

const axios = require('axios');
const KeywordPreferences = require('../models/KeywordPreferences');

class KeywordExtractionService {
  constructor() {
    this.aiEndpoint = process.env.AI_KEYWORD_EXTRACTION_ENDPOINT || 'http://localhost:3001/extract-keywords';
  }

  async extractKeywords(jobDescription, userId = null) {
    try {
      // Get user preferences for better extraction
      const preferences = userId ? await this.getUserPreferences(userId) : null;
      
      // AI-powered extraction
      const aiResult = await this.performAIExtraction(jobDescription, preferences);
      
      // Categorize and structure results
      const categorizedKeywords = this.categorizeKeywords(aiResult);
      
      return {
        success: true,
        keywords: categorizedKeywords,
        rawText: jobDescription,
        extractedAt: new Date()
      };
    } catch (error) {
      console.error('Keyword extraction failed:', error);
      return this.fallbackExtraction(jobDescription);
    }
  }

  async performAIExtraction(jobDescription, preferences) {
    const payload = {
      text: jobDescription,
      preferences: preferences?.preferredCategories || [],
      excludeWords: preferences?.excludedWords || []
    };

    const response = await axios.post(this.aiEndpoint, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    return response.data.keywords || [];
  }

  categorizeKeywords(keywords) {
    const categories = {
      requiredSkills: [],
      preferredSkills: [],
      technologies: [],
      certifications: [],
      softSkills: []
    };

    keywords.forEach(keyword => {
      const category = this.determineCategory(keyword);
      if (categories[category]) {
        categories[category].push({
          text: keyword.text,
          confidence: keyword.confidence || 0.8,
          context: keyword.context || '',
          highlighted: false
        });
      }
    });

    return categories;
  }

  determineCategory(keyword) {
    const techPatterns = /\b(javascript|python|react|node|sql|aws|docker|kubernetes)\b/i;
    const certPatterns = /\b(certified|certification|pmp|cissp|aws|azure|google cloud)\b/i;
    const softSkillPatterns = /\b(leadership|communication|teamwork|problem solving|creative)\b/i;
    
    if (techPatterns.test(keyword.text)) return 'technologies';
    if (certPatterns.test(keyword.text)) return 'certifications';
    if (softSkillPatterns.test(keyword.text)) return 'softSkills';
    if (keyword.required) return 'requiredSkills';
    return 'preferredSkills';
  }

  async updateKeywords(extractionId, updates, userId) {
    try {
      const updatedKeywords = { ...updates };
      
      // Save user preferences for future extractions
      if (userId) {
        await this.saveUserPreferences(userId, updates);
      }

      return {
        success: true,
        keywords: updatedKeywords,
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to update keywords:', error);
      throw new Error('Keyword update failed');
    }
  }

  async saveUserPreferences(userId, keywords) {
    const preferences = {
      userId,
      preferredCategories: Object.keys(keywords),
      frequentKeywords: this.extractFrequentKeywords(keywords),
      excludedWords: [],
      lastUpdated: new Date()
    };

    await KeywordPreferences.findOneAndUpdate(
      { userId },
      preferences,
      { upsert: true, new: true }
    );
  }

  async getUserPreferences(userId) {
    return await KeywordPreferences.findOne({ userId });
  }

  extractFrequentKeywords(keywords) {
    const allKeywords = [];
    Object.values(keywords).forEach(category => {
      if (Array.isArray(category)) {
        allKeywords.push(...category.map(k => k.text));
      }
    });
    return allKeywords.slice(0, 20);
  }

  fallbackExtraction(jobDescription) {
    const commonSkills = [
      'communication', 'teamwork', 'problem solving', 'leadership',
      'javascript', 'python', 'sql', 'react', 'node.js'
    ];

    const foundKeywords = commonSkills.filter(skill => 
      jobDescription.toLowerCase().includes(skill.toLowerCase())
    ).map(skill => ({
      text: skill,
      confidence: 0.6,
      context: 'fallback extraction',
      highlighted: false
    }));

    return {
      success: true,
      keywords: {
        requiredSkills: foundKeywords.slice(0, 3),
        preferredSkills: foundKeywords.slice(3, 6),
        technologies: foundKeywords.slice(6),
        certifications: [],
        softSkills: []
      },
      fallback: true,
      extractedAt: new Date()
    };
  }

  validateKeywords(keywords) {
    const requiredFields = ['requiredSkills', 'preferredSkills', 'technologies'];
    return requiredFields.every(field => 
      keywords[field] && Array.isArray(keywords[field])
    );
  }
}

module.exports = new KeywordExtractionService();
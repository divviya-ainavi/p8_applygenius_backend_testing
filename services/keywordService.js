const axios = require('axios');
const KeywordExtraction = require('../models/KeywordExtraction');

class KeywordService {
  constructor() {
    this.n8nWebhookUrl = process.env.N8N_KEYWORD_EXTRACTION_WEBHOOK_URL;
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  async extractKeywords(jobDescription, userId) {
    try {
      // Check cache first
      const cached = await this.getCachedExtraction(jobDescription);
      if (cached) {
        return cached.extractedData;
      }

      // Call n8n workflow
      const response = await axios.post(this.n8nWebhookUrl, {
        jobDescription,
        userId,
        timestamp: new Date().toISOString()
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.N8N_API_KEY}`
        }
      });

      const extractedData = this.formatExtractionResult(response.data);

      // Cache the result
      await this.cacheExtraction(jobDescription, extractedData, userId);

      return extractedData;
    } catch (error) {
      console.error('Keyword extraction failed:', error);
      throw new Error('Failed to extract keywords from job description');
    }
  }

  formatExtractionResult(rawData) {
    return {
      technicalSkills: this.formatKeywordCategory(rawData.technicalSkills || []),
      softSkills: this.formatKeywordCategory(rawData.softSkills || []),
      requirements: this.formatKeywordCategory(rawData.requirements || []),
      qualifications: this.formatKeywordCategory(rawData.qualifications || []),
      extractedAt: new Date(),
      totalKeywords: (rawData.technicalSkills?.length || 0) + 
                   (rawData.softSkills?.length || 0) + 
                   (rawData.requirements?.length || 0) + 
                   (rawData.qualifications?.length || 0)
    };
  }

  formatKeywordCategory(keywords) {
    return keywords.map(keyword => ({
      text: typeof keyword === 'string' ? keyword : keyword.text,
      confidence: typeof keyword === 'object' ? keyword.confidence || 0.8 : 0.8,
      id: this.generateKeywordId(typeof keyword === 'string' ? keyword : keyword.text),
      userAdded: false
    }));
  }

  generateKeywordId(text) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async getCachedExtraction(jobDescription) {
    const hash = this.createJobDescriptionHash(jobDescription);
    return await KeywordExtraction.findOne({
      jobDescriptionHash: hash,
      createdAt: { $gte: new Date(Date.now() - this.cacheTimeout) }
    });
  }

  async cacheExtraction(jobDescription, extractedData, userId) {
    const hash = this.createJobDescriptionHash(jobDescription);
    
    await KeywordExtraction.findOneAndUpdate(
      { jobDescriptionHash: hash },
      {
        jobDescriptionHash: hash,
        jobDescription: jobDescription.substring(0, 1000),
        extractedData,
        userId,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );
  }

  createJobDescriptionHash(text) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
  }

  async updateKeywords(extractionId, updates) {
    try {
      const extraction = await KeywordExtraction.findById(extractionId);
      if (!extraction) {
        throw new Error('Extraction not found');
      }

      const updatedData = { ...extraction.extractedData };
      
      // Apply updates to each category
      ['technicalSkills', 'softSkills', 'requirements', 'qualifications'].forEach(category => {
        if (updates[category]) {
          updatedData[category] = this.mergeKeywordUpdates(
            updatedData[category] || [],
            updates[category]
          );
        }
      });

      // Update total count
      updatedData.totalKeywords = Object.values(updatedData)
        .filter(Array.isArray)
        .reduce((sum, arr) => sum + arr.length, 0);

      await KeywordExtraction.findByIdAndUpdate(extractionId, {
        extractedData: updatedData,
        userModified: true,
        lastModified: new Date()
      });

      return updatedData;
    } catch (error) {
      console.error('Failed to update keywords:', error);
      throw new Error('Failed to update extracted keywords');
    }
  }

  mergeKeywordUpdates(existing, updates) {
    const keywordMap = new Map();
    
    // Add existing keywords
    existing.forEach(kw => keywordMap.set(kw.id, kw));
    
    // Apply updates
    updates.added?.forEach(text => {
      const id = this.generateKeywordId(text);
      keywordMap.set(id, {
        id,
        text,
        confidence: 1.0,
        userAdded: true
      });
    });

    updates.removed?.forEach(id => keywordMap.delete(id));

    return Array.from(keywordMap.values());
  }

  async getExtractionById(id) {
    return await KeywordExtraction.findById(id);
  }

  async cleanupOldExtractions() {
    const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days
    return await KeywordExtraction.deleteMany({
      createdAt: { $lt: cutoff },
      userModified: { $ne: true }
    });
  }
}

module.exports = new KeywordService();
import { Request, Response } from 'express';
import KeywordExtraction from '../models/KeywordExtraction.js';
import keywordExtractionService from '../services/keywordExtractionService.js';

// Extract keywords from job description
export const extractKeywords = async (req: Request, res: Response) => {
  try {
    const { jobDescription, userId } = req.body;

    if (!jobDescription || !userId) {
      return res.status(400).json({ 
        error: 'Job description and user ID are required' 
      });
    }

    // Use AI service to extract and categorize keywords
    const extractedKeywords = await keywordExtractionService.extractFromJobDescription(jobDescription);

    // Get user's historical preferences to improve extraction
    const userPreferences = await getUserKeywordPreferences(userId);
    
    // Apply user preferences to enhance extraction
    const enhancedKeywords = keywordExtractionService.applyUserPreferences(
      extractedKeywords, 
      userPreferences
    );

    // Save extraction for future reference
    const keywordExtraction = new KeywordExtraction({
      userId,
      jobDescription: jobDescription.substring(0, 2000), // Store truncated version
      extractedKeywords: enhancedKeywords,
      createdAt: new Date()
    });

    await keywordExtraction.save();

    res.status(200).json({
      success: true,
      data: {
        extractionId: keywordExtraction._id,
        keywords: enhancedKeywords,
        confidence: extractedKeywords.confidence || 0.8
      }
    });

  } catch (error) {
    console.error('Error extracting keywords:', error);
    res.status(500).json({ 
      error: 'Failed to extract keywords from job description' 
    });
  }
};

// Update extracted keywords with user modifications
export const updateKeywords = async (req: Request, res: Response) => {
  try {
    const { extractionId } = req.params;
    const { keywords, userId } = req.body;

    if (!extractionId || !keywords || !userId) {
      return res.status(400).json({ 
        error: 'Extraction ID, keywords, and user ID are required' 
      });
    }

    // Find and update the keyword extraction
    const extraction = await KeywordExtraction.findById(extractionId);
    
    if (!extraction) {
      return res.status(404).json({ 
        error: 'Keyword extraction not found' 
      });
    }

    if (extraction.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized to modify this extraction' 
      });
    }

    // Update keywords with user modifications
    extraction.extractedKeywords = keywords;
    extraction.userModified = true;
    extraction.lastModified = new Date();

    await extraction.save();

    // Update user preferences based on modifications
    await updateUserKeywordPreferences(userId, extraction.extractedKeywords, keywords);

    res.status(200).json({
      success: true,
      data: {
        extractionId: extraction._id,
        keywords: extraction.extractedKeywords
      }
    });

  } catch (error) {
    console.error('Error updating keywords:', error);
    res.status(500).json({ 
      error: 'Failed to update keywords' 
    });
  }
};

// Get keyword extraction by ID
export const getKeywordExtraction = async (req: Request, res: Response) => {
  try {
    const { extractionId } = req.params;
    const { userId } = req.query;

    if (!extractionId || !userId) {
      return res.status(400).json({ 
        error: 'Extraction ID and user ID are required' 
      });
    }

    const extraction = await KeywordExtraction.findById(extractionId);

    if (!extraction) {
      return res.status(404).json({ 
        error: 'Keyword extraction not found' 
      });
    }

    if (extraction.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized to access this extraction' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        extractionId: extraction._id,
        keywords: extraction.extractedKeywords,
        createdAt: extraction.createdAt,
        userModified: extraction.userModified
      }
    });

  } catch (error) {
    console.error('Error retrieving keyword extraction:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve keyword extraction' 
    });
  }
};

// Get user's keyword extraction history
export const getUserKeywordHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        error: 'User ID is required' 
      });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const extractions = await KeywordExtraction
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .select('_id extractedKeywords createdAt userModified');

    const total = await KeywordExtraction.countDocuments({ userId });

    res.status(200).json({
      success: true,
      data: {
        extractions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving keyword history:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve keyword history' 
    });
  }
};

// Get user's keyword preferences for improved extraction
export const getKeywordPreferences = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        error: 'User ID is required' 
      });
    }

    const preferences = await getUserKeywordPreferences(userId);

    res.status(200).json({
      success: true,
      data: preferences
    });

  } catch (error) {
    console.error('Error retrieving keyword preferences:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve keyword preferences' 
    });
  }
};

// Helper function to get user keyword preferences
const getUserKeywordPreferences = async (userId: string) => {
  try {
    // Analyze user's historical modifications to build preferences
    const recentExtractions = await KeywordExtraction
      .find({ 
        userId, 
        userModified: true 
      })
      .sort({ lastModified: -1 })
      .limit(10);

    const preferences = {
      frequentlyAddedKeywords: [],
      frequentlyRemovedKeywords: [],
      preferredCategories: [],
      skillPriorities: {}
    };

    // Analyze patterns in user modifications
    for (const extraction of recentExtractions) {
      // This would contain logic to analyze what users typically add/remove
      // For now, return basic structure
    }

    return preferences;
  } catch (error) {
    console.error('Error getting user keyword preferences:', error);
    return {
      frequentlyAddedKeywords: [],
      frequentlyRemovedKeywords: [],
      preferredCategories: [],
      skillPriorities: {}
    };
  }
};

// Helper function to update user keyword preferences
const updateUserKeywordPreferences = async (userId: string, originalKeywords: any, modifiedKeywords: any) => {
  try {
    // Logic to analyze the difference between original and modified keywords
    // and update user preferences accordingly
    
    // Find added keywords
    const addedKeywords = findAddedKeywords(originalKeywords, modifiedKeywords);
    
    // Find removed keywords
    const removedKeywords = findRemovedKeywords(originalKeywords, modifiedKeywords);

    // Store these insights for future extractions
    // This could be implemented as a separate UserKeywordPreference model
    // For now, we'll just log the insights

    console.log(`User ${userId} preferences updated:`, {
      added: addedKeywords.length,
      removed: removedKeywords.length
    });

  } catch (error) {
    console.error('Error updating user keyword preferences:', error);
  }
};

// Helper function to find added keywords
const findAddedKeywords = (original: any, modified: any) => {
  const addedKeywords = [];
  
  for (const category in modified) {
    if (modified[category] && original[category]) {
      const originalSet = new Set(original[category].map((k: any) => k.keyword || k));
      const modifiedSet = modified[category].filter((k: any) => 
        !originalSet.has(k.keyword || k)
      );
      addedKeywords.push(...modifiedSet);
    }
  }
  
  return addedKeywords;
};

// Helper function to find removed keywords
const findRemovedKeywords = (original: any, modified: any) => {
  const removedKeywords = [];
  
  for (const category in original) {
    if (original[category] && modified[category]) {
      const modifiedSet = new Set(modified[category].map((k: any) => k.keyword || k));
      const removedSet = original[category].filter((k: any) => 
        !modifiedSet.has(k.keyword || k)
      );
      removedKeywords.push(...removedSet);
    }
  }
  
  return removedKeywords;
};

// Delete keyword extraction
export const deleteKeywordExtraction = async (req: Request, res: Response) => {
  try {
    const { extractionId } = req.params;
    const { userId } = req.query;

    if (!extractionId || !userId) {
      return res.status(400).json({ 
        error: 'Extraction ID and user ID are required' 
      });
    }

    const extraction = await KeywordExtraction.findById(extractionId);

    if (!extraction) {
      return res.status(404).json({ 
        error: 'Keyword extraction not found' 
      });
    }

    if (extraction.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized to delete this extraction' 
      });
    }

    await KeywordExtraction.findByIdAndDelete(extractionId);

    res.status(200).json({
      success: true,
      message: 'Keyword extraction deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting keyword extraction:', error);
    res.status(500).json({ 
      error: 'Failed to delete keyword extraction' 
    });
  }
};
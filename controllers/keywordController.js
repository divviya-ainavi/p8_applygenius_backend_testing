import { Request, Response } from 'express';
import KeywordExtraction from '../models/KeywordExtraction.js';
import keywordService from '../services/keywordService.js';
import crypto from 'crypto';

// Extract keywords from job description
export const extractKeywords = async (req: Request, res: Response) => {
  try {
    const { jobDescription, userId } = req.body;

    if (!jobDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Job description and user ID are required'
      });
    }

    // Create hash of job description to check for existing extractions
    const contentHash = crypto
      .createHash('sha256')
      .update(jobDescription.trim().toLowerCase())
      .digest('hex');

    // Check if we already have extraction for this job description
    const existingExtraction = await KeywordExtraction.findOne({
      contentHash,
      userId
    });

    if (existingExtraction) {
      return res.status(200).json({
        success: true,
        data: {
          extractionId: existingExtraction._id,
          keywords: existingExtraction.extractedKeywords,
          userModifications: existingExtraction.userModifications,
          confidence: existingExtraction.confidence,
          lastExtracted: existingExtraction.updatedAt
        }
      });
    }

    // Trigger keyword extraction via n8n workflow
    const extractionResult = await keywordService.extractKeywords(jobDescription);

    if (!extractionResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to extract keywords from job description'
      });
    }

    // Save extraction to database
    const keywordExtraction = new KeywordExtraction({
      userId,
      jobDescription,
      contentHash,
      extractedKeywords: extractionResult.keywords,
      confidence: extractionResult.confidence || 0.8,
      userModifications: {
        added: [],
        removed: [],
        modified: []
      }
    });

    await keywordExtraction.save();

    res.status(201).json({
      success: true,
      data: {
        extractionId: keywordExtraction._id,
        keywords: extractionResult.keywords,
        userModifications: keywordExtraction.userModifications,
        confidence: extractionResult.confidence || 0.8,
        lastExtracted: keywordExtraction.createdAt
      }
    });

  } catch (error) {
    console.error('Error in extractKeywords:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during keyword extraction'
    });
  }
};

// Update user modifications to extracted keywords
export const updateKeywords = async (req: Request, res: Response) => {
  try {
    const { extractionId } = req.params;
    const { addedKeywords = [], removedKeywords = [], modifiedKeywords = [] } = req.body;

    if (!extractionId) {
      return res.status(400).json({
        success: false,
        error: 'Extraction ID is required'
      });
    }

    const extraction = await KeywordExtraction.findById(extractionId);

    if (!extraction) {
      return res.status(404).json({
        success: false,
        error: 'Keyword extraction not found'
      });
    }

    // Update user modifications
    extraction.userModifications = {
      added: addedKeywords,
      removed: removedKeywords,
      modified: modifiedKeywords
    };

    await extraction.save();

    // Merge original keywords with user modifications
    const finalKeywords = keywordService.mergeUserModifications(
      extraction.extractedKeywords,
      extraction.userModifications
    );

    res.status(200).json({
      success: true,
      data: {
        extractionId: extraction._id,
        keywords: finalKeywords,
        userModifications: extraction.userModifications,
        confidence: extraction.confidence
      }
    });

  } catch (error) {
    console.error('Error in updateKeywords:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during keyword update'
    });
  }
};

// Get extraction by ID
export const getExtraction = async (req: Request, res: Response) => {
  try {
    const { extractionId } = req.params;

    if (!extractionId) {
      return res.status(400).json({
        success: false,
        error: 'Extraction ID is required'
      });
    }

    const extraction = await KeywordExtraction.findById(extractionId);

    if (!extraction) {
      return res.status(404).json({
        success: false,
        error: 'Keyword extraction not found'
      });
    }

    // Merge original keywords with user modifications
    const finalKeywords = keywordService.mergeUserModifications(
      extraction.extractedKeywords,
      extraction.userModifications
    );

    res.status(200).json({
      success: true,
      data: {
        extractionId: extraction._id,
        keywords: finalKeywords,
        originalKeywords: extraction.extractedKeywords,
        userModifications: extraction.userModifications,
        confidence: extraction.confidence,
        jobDescription: extraction.jobDescription,
        lastExtracted: extraction.updatedAt
      }
    });

  } catch (error) {
    console.error('Error in getExtraction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error retrieving keyword extraction'
    });
  }
};

// Get user's extraction history
export const getExtractionHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const extractions = await KeywordExtraction.find({ userId })
      .select('_id jobDescription confidence createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await KeywordExtraction.countDocuments({ userId });

    res.status(200).json({
      success: true,
      data: {
        extractions: extractions.map(extraction => ({
          extractionId: extraction._id,
          jobDescriptionPreview: extraction.jobDescription.substring(0, 150) + '...',
          confidence: extraction.confidence,
          lastExtracted: extraction.updatedAt,
          createdAt: extraction.createdAt
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error in getExtractionHistory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error retrieving extraction history'
    });
  }
};

// Delete extraction
export const deleteExtraction = async (req: Request, res: Response) => {
  try {
    const { extractionId } = req.params;

    if (!extractionId) {
      return res.status(400).json({
        success: false,
        error: 'Extraction ID is required'
      });
    }

    const extraction = await KeywordExtraction.findByIdAndDelete(extractionId);

    if (!extraction) {
      return res.status(404).json({
        success: false,
        error: 'Keyword extraction not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Keyword extraction deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteExtraction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error deleting keyword extraction'
    });
  }
};
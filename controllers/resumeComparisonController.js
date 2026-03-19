import { Request, Response } from 'express';
import ResumeComparison from '../models/ResumeComparison.js';
import { diffMatchPatch } from 'diff-match-patch';

const dmp = new diffMatchPatch();

export const createComparison = async (req: Request, res: Response) => {
  try {
    const { originalText, enhancedText, userId } = req.body;

    if (!originalText || !enhancedText || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const diffs = dmp.diff_main(originalText, enhancedText);
    dmp.diff_cleanupSemantic(diffs);

    const changes = [];
    let originalIndex = 0;
    let enhancedIndex = 0;

    for (const [operation, text] of diffs) {
      if (operation === 0) { // EQUAL
        originalIndex += text.length;
        enhancedIndex += text.length;
      } else if (operation === -1) { // DELETE
        changes.push({
          type: 'deletion',
          text,
          originalStart: originalIndex,
          originalEnd: originalIndex + text.length,
          reasoning: generateDeletionReason(text)
        });
        originalIndex += text.length;
      } else if (operation === 1) { // INSERT
        changes.push({
          type: 'addition',
          text,
          enhancedStart: enhancedIndex,
          enhancedEnd: enhancedIndex + text.length,
          reasoning: generateAdditionReason(text)
        });
        enhancedIndex += text.length;
      }
    }

    const comparison = new ResumeComparison({
      userId,
      originalText,
      enhancedText,
      changes,
      createdAt: new Date()
    });

    await comparison.save();

    res.status(201).json({
      success: true,
      data: {
        id: comparison._id,
        changes,
        summary: {
          additions: changes.filter(c => c.type === 'addition').length,
          deletions: changes.filter(c => c.type === 'deletion').length,
          modifications: changes.filter(c => c.type === 'modification').length
        }
      }
    });
  } catch (error) {
    console.error('Create comparison error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getComparison = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comparison = await ResumeComparison.findById(id);

    if (!comparison) {
      return res.status(404).json({ error: 'Comparison not found' });
    }

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Get comparison error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserComparisons = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const comparisons = await ResumeComparison.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: comparisons
    });
  } catch (error) {
    console.error('Get user comparisons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getChangeReasoning = async (req: Request, res: Response) => {
  try {
    const { comparisonId, changeIndex } = req.params;
    const comparison = await ResumeComparison.findById(comparisonId);

    if (!comparison) {
      return res.status(404).json({ error: 'Comparison not found' });
    }

    const change = comparison.changes[parseInt(changeIndex)];
    if (!change) {
      return res.status(404).json({ error: 'Change not found' });
    }

    res.json({
      success: true,
      data: {
        reasoning: change.reasoning,
        type: change.type,
        text: change.text
      }
    });
  } catch (error) {
    console.error('Get change reasoning error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const generateAdditionReason = (text: string): string => {
  if (text.includes('•') || text.includes('-')) {
    return 'Added bullet point to improve readability and highlight key achievements';
  }
  if (text.match(/\d+%|\d+\$|\d+k/)) {
    return 'Added quantifiable metrics to demonstrate measurable impact';
  }
  if (text.toLowerCase().includes('led') || text.toLowerCase().includes('managed')) {
    return 'Added leadership language to showcase management capabilities';
  }
  return 'Enhanced content to improve clarity and professional presentation';
};

const generateDeletionReason = (text: string): string => {
  if (text.length > 50) {
    return 'Removed verbose content to improve conciseness and readability';
  }
  if (text.toLowerCase().includes('i ') || text.toLowerCase().includes('my ')) {
    return 'Removed first-person pronouns for professional tone';
  }
  return 'Removed redundant or less impactful content to focus on key strengths';
};
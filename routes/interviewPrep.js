import { Router } from 'express';
import {
  generateQuestions,
  saveAnswer,
  getPreparationData,
  updateProgress,
  exportPrepMaterials,
  provideFeedback,
  getQuestionsByCategory,
  updateAnswer,
  deleteAnswer,
  getProgressStats
} from '../controllers/interviewPrepController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Generate interview questions based on job description and user profile
router.post('/generate-questions',
  [
    body('applicationKitId').notEmpty().withMessage('Application kit ID is required'),
    body('questionCount').optional().isInt({ min: 1, max: 50 }).withMessage('Question count must be between 1 and 50'),
    body('categories').optional().isArray().withMessage('Categories must be an array'),
    body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level')
  ],
  validateRequest,
  generateQuestions
);

// Get all preparation data for a specific application kit
router.get('/application/:applicationKitId',
  [
    param('applicationKitId').notEmpty().withMessage('Application kit ID is required')
  ],
  validateRequest,
  getPreparationData
);

// Get questions by category
router.get('/questions/:applicationKitId',
  [
    param('applicationKitId').notEmpty().withMessage('Application kit ID is required'),
    query('category').optional().isIn(['behavioral', 'technical', 'situational', 'company-specific']).withMessage('Invalid category'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validateRequest,
  getQuestionsByCategory
);

// Save or update user's answer to a question
router.post('/answers',
  [
    body('questionId').notEmpty().withMessage('Question ID is required'),
    body('answer').notEmpty().withMessage('Answer is required'),
    body('situation').optional().isString(),
    body('task').optional().isString(),
    body('action').optional().isString(),
    body('result').optional().isString(),
    body('isStarFormat').optional().isBoolean()
  ],
  validateRequest,
  saveAnswer
);

// Update existing answer
router.put('/answers/:answerId',
  [
    param('answerId').notEmpty().withMessage('Answer ID is required'),
    body('answer').optional().isString(),
    body('situation').optional().isString(),
    body('task').optional().isString(),
    body('action').optional().isString(),
    body('result').optional().isString(),
    body('isStarFormat').optional().isBoolean(),
    body('isPracticed').optional().isBoolean()
  ],
  validateRequest,
  updateAnswer
);

// Delete answer
router.delete('/answers/:answerId',
  [
    param('answerId').notEmpty().withMessage('Answer ID is required')
  ],
  validateRequest,
  deleteAnswer
);

// Get AI feedback on user's answer
router.post('/feedback',
  [
    body('questionId').notEmpty().withMessage('Question ID is required'),
    body('answer').notEmpty().withMessage('Answer is required'),
    body('feedbackType').optional().isIn(['structure', 'content', 'star-format', 'overall']).withMessage('Invalid feedback type')
  ],
  validateRequest,
  provideFeedback
);

// Update preparation progress
router.patch('/progress/:applicationKitId',
  [
    param('applicationKitId').notEmpty().withMessage('Application kit ID is required'),
    body('questionId').notEmpty().withMessage('Question ID is required'),
    body('status').isIn(['not-started', 'in-progress', 'completed']).withMessage('Invalid status'),
    body('practiceCount').optional().isInt({ min: 0 }).withMessage('Practice count must be a positive integer'),
    body('confidenceLevel').optional().isInt({ min: 1, max: 5 }).withMessage('Confidence level must be between 1 and 5')
  ],
  validateRequest,
  updateProgress
);

// Get progress statistics
router.get('/progress/:applicationKitId/stats',
  [
    param('applicationKitId').notEmpty().withMessage('Application kit ID is required')
  ],
  validateRequest,
  getProgressStats
);

// Export preparation materials as study guide
router.post('/export/:applicationKitId',
  [
    param('applicationKitId').notEmpty().withMessage('Application kit ID is required'),
    body('format').optional().isIn(['pdf', 'docx', 'json']).withMessage('Invalid export format'),
    body('includeAnswers').optional().isBoolean(),
    body('includeProgress').optional().isBoolean(),
    body('categories').optional().isArray().withMessage('Categories must be an array')
  ],
  validateRequest,
  exportPrepMaterials
);

export default router;
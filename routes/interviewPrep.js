import { Router } from 'express';
import { 
  generateQuestions, 
  savePracticeSession, 
  getPracticeSessions, 
  updatePracticeSession,
  getSessionStats,
  deleteSession
} from '../controllers/interviewPrepController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Generate interview questions based on job description and user profile
router.post('/generate-questions',
  [
    body('jobDescription').notEmpty().withMessage('Job description is required'),
    body('seniorityLevel').isIn(['entry', 'mid', 'senior', 'executive']).withMessage('Invalid seniority level'),
    body('roleType').notEmpty().withMessage('Role type is required'),
    body('userId').isMongoId().withMessage('Valid user ID is required')
  ],
  validateRequest,
  generateQuestions
);

// Save a new practice session
router.post('/sessions',
  [
    body('questionId').isMongoId().withMessage('Valid question ID is required'),
    body('question').notEmpty().withMessage('Question is required'),
    body('answer').optional().isString(),
    body('category').isIn(['behavioral', 'technical', 'role-specific']).withMessage('Invalid category'),
    body('duration').optional().isInt({ min: 0 }),
    body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level')
  ],
  validateRequest,
  savePracticeSession
);

// Get all practice sessions for a user
router.get('/sessions',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('category').optional().isIn(['behavioral', 'technical', 'role-specific']),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
  ],
  validateRequest,
  getPracticeSessions
);

// Update a specific practice session
router.put('/sessions/:sessionId',
  [
    param('sessionId').isMongoId().withMessage('Valid session ID is required'),
    body('answer').optional().isString(),
    body('duration').optional().isInt({ min: 0 }),
    body('feedback').optional().isString(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('improvementNotes').optional().isString()
  ],
  validateRequest,
  updatePracticeSession
);

// Get practice session statistics and analytics
router.get('/stats',
  [
    query('period').optional().isIn(['week', 'month', '3months', 'year']),
    query('category').optional().isIn(['behavioral', 'technical', 'role-specific'])
  ],
  validateRequest,
  getSessionStats
);

// Delete a practice session
router.delete('/sessions/:sessionId',
  [
    param('sessionId').isMongoId().withMessage('Valid session ID is required')
  ],
  validateRequest,
  deleteSession
);

// Get a specific practice session
router.get('/sessions/:sessionId',
  [
    param('sessionId').isMongoId().withMessage('Valid session ID is required')
  ],
  validateRequest,
  getPracticeSessions
);

export default router;
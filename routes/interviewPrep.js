import { Router } from 'express';
import {
  generateQuestions,
  createPracticeSession,
  updatePracticeSession,
  getPracticeHistory,
  generateStarTemplate,
  getInterviewInsights,
  deletePracticeSession
} from '../controllers/interviewPrepController.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Generate interview questions based on job description and user profile
router.post(
  '/questions/generate',
  [
    body('jobDescription').notEmpty().withMessage('Job description is required'),
    body('roleType').notEmpty().withMessage('Role type is required'),
    body('seniorityLevel').isIn(['entry', 'mid', 'senior', 'lead', 'executive']).withMessage('Invalid seniority level'),
    body('industry').optional().isString(),
    body('companySize').optional().isString(),
  ],
  validateRequest,
  generateQuestions
);

// Generate STAR format answer template
router.post(
  '/star-template',
  [
    body('question').notEmpty().withMessage('Question is required'),
    body('userExperience').isArray().withMessage('User experience must be an array'),
    body('questionCategory').isIn(['behavioral', 'technical', 'situational']).withMessage('Invalid question category'),
  ],
  validateRequest,
  generateStarTemplate
);

// Create new practice session
router.post(
  '/sessions',
  [
    body('questions').isArray({ min: 1 }).withMessage('Questions array is required'),
    body('sessionType').isIn(['quick', 'full', 'focused']).withMessage('Invalid session type'),
    body('duration').optional().isInt({ min: 1 }),
  ],
  validateRequest,
  createPracticeSession
);

// Update practice session with answers and feedback
router.patch(
  '/sessions/:sessionId',
  [
    param('sessionId').isMongoId().withMessage('Invalid session ID'),
    body('answers').optional().isArray(),
    body('feedback').optional().isObject(),
    body('completed').optional().isBoolean(),
    body('score').optional().isInt({ min: 0, max: 100 }),
  ],
  validateRequest,
  updatePracticeSession
);

// Get practice session history
router.get(
  '/sessions',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    query('sessionType').optional().isIn(['quick', 'full', 'focused']),
  ],
  validateRequest,
  getPracticeHistory
);

// Get specific practice session
router.get(
  '/sessions/:sessionId',
  [
    param('sessionId').isMongoId().withMessage('Invalid session ID'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const session = await InterviewSession.findOne({
        _id: req.params.sessionId,
        userId: req.user.id
      });
      
      if (!session) {
        return res.status(404).json({ error: 'Practice session not found' });
      }
      
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve practice session' });
    }
  }
);

// Delete practice session
router.delete(
  '/sessions/:sessionId',
  [
    param('sessionId').isMongoId().withMessage('Invalid session ID'),
  ],
  validateRequest,
  deletePracticeSession
);

// Get interview insights and analytics
router.get(
  '/insights',
  [
    query('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('roleType').optional().isString(),
  ],
  validateRequest,
  getInterviewInsights
);

// Get recommended questions for practice
router.get(
  '/recommendations',
  [
    query('weakAreas').optional().isArray(),
    query('roleType').optional().isString(),
    query('count').optional().isInt({ min: 1, max: 20 }).withMessage('Count must be between 1 and 20'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { weakAreas, roleType, count = 10 } = req.query;
      
      // Get user's practice history to identify weak areas
      const recentSessions = await InterviewSession.find({
        userId: req.user.id,
        completed: true
      })
      .sort({ createdAt: -1 })
      .limit(10);
      
      // Analyze performance and generate recommendations
      const recommendations = await generateQuestionRecommendations(
        req.user.id,
        recentSessions,
        { weakAreas, roleType, count }
      );
      
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  }
);

// Bulk generate questions for multiple job descriptions
router.post(
  '/questions/bulk-generate',
  [
    body('jobs').isArray({ min: 1, max: 5 }).withMessage('Jobs array must contain 1-5 items'),
    body('jobs.*.jobDescription').notEmpty().withMessage('Job description is required for each job'),
    body('jobs.*.roleType').notEmpty().withMessage('Role type is required for each job'),
    body('jobs.*.seniorityLevel').isIn(['entry', 'mid', 'senior', 'lead', 'executive']),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { jobs } = req.body;
      const results = [];
      
      for (const job of jobs) {
        const questions = await generateQuestionsForJob({
          ...job,
          userId: req.user.id
        });
        results.push({
          jobId: job.jobId || `job_${Date.now()}`,
          questions
        });
      }
      
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate bulk questions' });
    }
  }
);

export default router;
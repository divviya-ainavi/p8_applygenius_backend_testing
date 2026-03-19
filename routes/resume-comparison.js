import { Router } from 'express';
import resumeComparisonController from '../controllers/resumeComparisonController.js';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Validation middleware for comparison creation
const validateComparisonCreation = [
  body('originalResumeId')
    .notEmpty()
    .withMessage('Original resume ID is required')
    .isMongoId()
    .withMessage('Invalid original resume ID format'),
  body('enhancedResumeId')
    .notEmpty()
    .withMessage('Enhanced resume ID is required')
    .isMongoId()
    .withMessage('Invalid enhanced resume ID format'),
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  validateRequest
];

// Validation middleware for getting comparison by ID
const validateComparisonId = [
  param('comparisonId')
    .notEmpty()
    .withMessage('Comparison ID is required')
    .isMongoId()
    .withMessage('Invalid comparison ID format'),
  validateRequest
];

// Validation middleware for user comparisons query
const validateUserComparisons = [
  query('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validateRequest
];

// Validation middleware for change reasoning request
const validateChangeReasoning = [
  param('comparisonId')
    .notEmpty()
    .withMessage('Comparison ID is required')
    .isMongoId()
    .withMessage('Invalid comparison ID format'),
  body('changeId')
    .notEmpty()
    .withMessage('Change ID is required'),
  body('section')
    .optional()
    .isIn(['summary', 'experience', 'education', 'skills', 'contact', 'achievements'])
    .withMessage('Invalid section type'),
  validateRequest
];

// Create a new resume comparison
router.post(
  '/',
  authenticateToken,
  validateComparisonCreation,
  resumeComparisonController.createComparison
);

// Get comparison by ID with full diff data
router.get(
  '/:comparisonId',
  authenticateToken,
  validateComparisonId,
  resumeComparisonController.getComparisonById
);

// Get all comparisons for a user
router.get(
  '/user/:userId',
  authenticateToken,
  param('userId').isMongoId().withMessage('Invalid user ID format'),
  validateRequest,
  resumeComparisonController.getUserComparisons
);

// Get paginated comparisons with filters
router.get(
  '/',
  authenticateToken,
  validateUserComparisons,
  resumeComparisonController.getComparisons
);

// Get AI reasoning for a specific change
router.post(
  '/:comparisonId/reasoning',
  authenticateToken,
  validateChangeReasoning,
  resumeComparisonController.getChangeReasoning
);

// Update comparison metadata (e.g., user notes, favorites)
router.patch(
  '/:comparisonId',
  authenticateToken,
  validateComparisonId,
  body('userNotes').optional().isString().withMessage('User notes must be a string'),
  body('isFavorite').optional().isBoolean().withMessage('isFavorite must be a boolean'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().withMessage('Each tag must be a string'),
  validateRequest,
  resumeComparisonController.updateComparison
);

// Delete a comparison
router.delete(
  '/:comparisonId',
  authenticateToken,
  validateComparisonId,
  resumeComparisonController.deleteComparison
);

// Generate and cache diff data for existing comparison
router.post(
  '/:comparisonId/regenerate-diff',
  authenticateToken,
  validateComparisonId,
  resumeComparisonController.regenerateDiff
);

// Get comparison statistics for analytics
router.get(
  '/stats/:userId',
  authenticateToken,
  param('userId').isMongoId().withMessage('Invalid user ID format'),
  validateRequest,
  resumeComparisonController.getComparisonStats
);

// Export comparison data for PDF generation
router.get(
  '/:comparisonId/export',
  authenticateToken,
  validateComparisonId,
  query('format').optional().isIn(['json', 'html']).withMessage('Format must be json or html'),
  validateRequest,
  resumeComparisonController.exportComparison
);

// Bulk create comparisons for batch processing
router.post(
  '/bulk',
  authenticateToken,
  body('comparisons').isArray().withMessage('Comparisons must be an array'),
  body('comparisons.*.originalResumeId').isMongoId().withMessage('Invalid original resume ID'),
  body('comparisons.*.enhancedResumeId').isMongoId().withMessage('Invalid enhanced resume ID'),
  body('comparisons.*.userId').isMongoId().withMessage('Invalid user ID'),
  validateRequest,
  resumeComparisonController.bulkCreateComparisons
);

export default router;
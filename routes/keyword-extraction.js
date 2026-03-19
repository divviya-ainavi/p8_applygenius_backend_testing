import { Router } from 'express';
import { body, param } from 'express-validator';
import keywordController from '../controllers/keywordController.js';
import { validateRequest } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// POST /api/keyword-extraction - Extract keywords from job description
router.post(
  '/',
  [
    body('jobDescription')
      .isString()
      .notEmpty()
      .withMessage('Job description is required')
      .isLength({ min: 50, max: 10000 })
      .withMessage('Job description must be between 50 and 10,000 characters'),
    body('jobTitle')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Job title must be less than 200 characters'),
    body('company')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Company name must be less than 200 characters'),
    body('forceRefresh')
      .optional()
      .isBoolean()
      .withMessage('forceRefresh must be a boolean')
  ],
  validateRequest,
  keywordController.extractKeywords
);

// GET /api/keyword-extraction/:id - Get existing extraction results
router.get(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid extraction ID format')
  ],
  validateRequest,
  keywordController.getExtraction
);

// PATCH /api/keyword-extraction/:id - Update user modifications to extracted keywords
router.patch(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid extraction ID format'),
    body('userModifications')
      .isObject()
      .withMessage('User modifications must be an object'),
    body('userModifications.addedKeywords')
      .optional()
      .isArray()
      .withMessage('Added keywords must be an array'),
    body('userModifications.removedKeywords')
      .optional()
      .isArray()
      .withMessage('Removed keywords must be an array'),
    body('userModifications.modifiedConfidenceScores')
      .optional()
      .isObject()
      .withMessage('Modified confidence scores must be an object')
  ],
  validateRequest,
  keywordController.updateExtraction
);

// DELETE /api/keyword-extraction/:id - Delete extraction results
router.delete(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid extraction ID format')
  ],
  validateRequest,
  keywordController.deleteExtraction
);

// GET /api/keyword-extraction/user/:userId - Get user's extraction history
router.get(
  '/user/:userId',
  [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format')
  ],
  validateRequest,
  keywordController.getUserExtractions
);

// POST /api/keyword-extraction/:id/regenerate - Regenerate keywords with updated parameters
router.post(
  '/:id/regenerate',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid extraction ID format'),
    body('focusAreas')
      .optional()
      .isArray()
      .withMessage('Focus areas must be an array'),
    body('excludeTerms')
      .optional()
      .isArray()
      .withMessage('Exclude terms must be an array')
  ],
  validateRequest,
  keywordController.regenerateKeywords
);

export default router;
const { Router } = require('express');
const { keywordController } = require('../controllers/keywordController');
const { body, param, query } = require('express-validator');

// Inline validation middleware (runs express-validator results)
const validationMiddleware = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const router = Router();

// Extract keywords from job description
router.post('/extract',
  [
    body('jobDescription')
      .notEmpty()
      .withMessage('Job description is required')
      .isLength({ min: 50 })
      .withMessage('Job description must be at least 50 characters long'),
    body('jobTitle')
      .optional()
      .isString()
      .withMessage('Job title must be a string'),
    body('company')
      .optional()
      .isString()
      .withMessage('Company name must be a string')
  ],
  validationMiddleware,
  keywordController.extractKeywords
);

// Save keyword preferences for user
router.post('/preferences',
  [
    body('extractionId')
      .isMongoId()
      .withMessage('Valid extraction ID is required'),
    body('modifiedKeywords')
      .isObject()
      .withMessage('Modified keywords must be an object'),
    body('modifiedKeywords.required')
      .isArray()
      .withMessage('Required keywords must be an array'),
    body('modifiedKeywords.preferred')
      .isArray()
      .withMessage('Preferred keywords must be an array'),
    body('modifiedKeywords.technologies')
      .isArray()
      .withMessage('Technologies must be an array'),
    body('addedKeywords')
      .optional()
      .isArray()
      .withMessage('Added keywords must be an array'),
    body('removedKeywords')
      .optional()
      .isArray()
      .withMessage('Removed keywords must be an array')
  ],
  validationMiddleware,
  keywordController.savePreferences
);

// Get keyword extraction by ID
router.get('/extraction/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Valid extraction ID is required')
  ],
  validationMiddleware,
  keywordController.getExtraction
);

// Get user's keyword extractions with pagination
router.get('/extractions',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('jobTitle')
      .optional()
      .isString()
      .withMessage('Job title filter must be a string'),
    query('company')
      .optional()
      .isString()
      .withMessage('Company filter must be a string')
  ],
  validationMiddleware,
  keywordController.getUserExtractions
);

// Update keyword extraction
router.put('/extraction/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Valid extraction ID is required'),
    body('keywords')
      .optional()
      .isObject()
      .withMessage('Keywords must be an object'),
    body('userModifications')
      .optional()
      .isObject()
      .withMessage('User modifications must be an object'),
    body('jobTitle')
      .optional()
      .isString()
      .withMessage('Job title must be a string'),
    body('company')
      .optional()
      .isString()
      .withMessage('Company name must be a string')
  ],
  validationMiddleware,
  keywordController.updateExtraction
);

// Delete keyword extraction
router.delete('/extraction/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Valid extraction ID is required')
  ],
  validationMiddleware,
  keywordController.deleteExtraction
);

// Get keyword suggestions based on job title/industry
router.get('/suggestions',
  [
    query('jobTitle')
      .optional()
      .isString()
      .withMessage('Job title must be a string'),
    query('industry')
      .optional()
      .isString()
      .withMessage('Industry must be a string'),
    query('category')
      .optional()
      .isIn(['required', 'preferred', 'technologies'])
      .withMessage('Category must be one of: required, preferred, technologies')
  ],
  validationMiddleware,
  keywordController.getKeywordSuggestions
);

// Bulk extract keywords from multiple job descriptions
router.post('/bulk-extract',
  [
    body('jobDescriptions')
      .isArray({ min: 1, max: 10 })
      .withMessage('Job descriptions must be an array with 1-10 items'),
    body('jobDescriptions.*.description')
      .notEmpty()
      .withMessage('Each job description is required'),
    body('jobDescriptions.*.jobTitle')
      .optional()
      .isString()
      .withMessage('Job title must be a string'),
    body('jobDescriptions.*.company')
      .optional()
      .isString()
      .withMessage('Company name must be a string')
  ],
  validationMiddleware,
  keywordController.bulkExtractKeywords
);

// Get keyword analytics for user
router.get('/analytics',
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO date'),
    query('jobTitle')
      .optional()
      .isString()
      .withMessage('Job title filter must be a string')
  ],
  validationMiddleware,
  keywordController.getKeywordAnalytics
);

// Validate keywords against resume content
router.post('/validate',
  [
    body('keywords')
      .isObject()
      .withMessage('Keywords must be an object'),
    body('resumeContent')
      .notEmpty()
      .withMessage('Resume content is required'),
    body('extractionId')
      .optional()
      .isMongoId()
      .withMessage('Extraction ID must be valid if provided')
  ],
  validationMiddleware,
  keywordController.validateKeywords
);

module.exports = router;
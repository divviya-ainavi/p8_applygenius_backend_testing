const validator = require('validator');
const { URL } = require('url');

// Supported job board platforms and their URL patterns
const SUPPORTED_PLATFORMS = {
  linkedin: {
    patterns: [
      /linkedin\.com\/jobs\/view\/\d+/,
      /linkedin\.com\/jobs\/search\/.*jobId=\d+/
    ],
    domain: 'linkedin.com'
  },
  indeed: {
    patterns: [
      /indeed\.com\/viewjob\?jk=[\w\d]+/,
      /indeed\.com\/jobs\/view\/[\w\d]+/
    ],
    domain: 'indeed.com'
  },
  glassdoor: {
    patterns: [
      /glassdoor\.com\/job-listing\/.*JV_IC\d+_KO/,
      /glassdoor\.com\/Jobs\/.*JV_\w+\.htm/
    ],
    domain: 'glassdoor.com'
  },
  monster: {
    patterns: [
      /monster\.com\/job-openings\/[\w-]+\/\w+/,
      /monster\.com\/jobs\/search\/.*Id_\d+/
    ],
    domain: 'monster.com'
  },
  ziprecruiter: {
    patterns: [
      /ziprecruiter\.com\/jobs\/[\w-]+\/\w+/,
      /ziprecruiter\.com\/ojob\/\w+/
    ],
    domain: 'ziprecruiter.com'
  },
  dice: {
    patterns: [
      /dice\.com\/jobs\/detail\/[\w\d-]+/,
      /dice\.com\/job-detail\/[\w\d-]+/
    ],
    domain: 'dice.com'
  }
};

// Company career page patterns (generic patterns for company websites)
const COMPANY_CAREER_PATTERNS = [
  /careers?\./,
  /jobs\./,
  /\/careers?\//,
  /\/jobs?\//,
  /\/job-openings?\//,
  /\/positions?\//,
  /\/opportunities/,
  /\/employment/,
  /\/work-with-us/,
  /\/join-us/,
  /\/hiring/
];

/**
 * Validate if URL is a valid job posting URL
 * @param {string} url - The URL to validate
 * @returns {Object} Validation result with isValid, platform, and error message
 */
const validateJobUrl = (url) => {
  try {
    // Basic URL format validation
    if (!validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true
    })) {
      return {
        isValid: false,
        platform: null,
        error: 'Invalid URL format. Please provide a valid HTTP/HTTPS URL.'
      };
    }

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // Check for supported job board platforms
    for (const [platformName, config] of Object.entries(SUPPORTED_PLATFORMS)) {
      if (hostname.includes(config.domain)) {
        // Check if URL matches platform-specific patterns
        const matchesPattern = config.patterns.some(pattern => pattern.test(fullUrl));
        
        if (matchesPattern) {
          return {
            isValid: true,
            platform: platformName,
            error: null,
            urlType: 'job_board'
          };
        } else {
          return {
            isValid: false,
            platform: platformName,
            error: `URL appears to be from ${platformName} but doesn't match expected job posting format.`
          };
        }
      }
    }

    // Check for company career pages
    const isCareerPage = COMPANY_CAREER_PATTERNS.some(pattern => pattern.test(fullUrl));
    
    if (isCareerPage) {
      return {
        isValid: true,
        platform: 'company_website',
        error: null,
        urlType: 'company_career'
      };
    }

    // If no patterns match, it might still be a valid job posting
    // but we'll need to attempt parsing to determine
    return {
      isValid: true,
      platform: 'unknown',
      error: null,
      urlType: 'unknown',
      warning: 'URL format not recognized. Will attempt to parse as generic job posting.'
    };

  } catch (error) {
    return {
      isValid: false,
      platform: null,
      error: 'Invalid URL format or structure.'
    };
  }
};

/**
 * Express middleware to validate job posting URLs
 */
const urlValidationMiddleware = (req, res, next) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
      code: 'URL_REQUIRED'
    });
  }

  if (typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'URL must be a non-empty string',
      code: 'INVALID_URL_TYPE'
    });
  }

  // Trim and normalize URL
  const normalizedUrl = url.trim();
  
  // Validate URL length (prevent extremely long URLs)
  if (normalizedUrl.length > 2048) {
    return res.status(400).json({
      success: false,
      error: 'URL is too long. Maximum length is 2048 characters.',
      code: 'URL_TOO_LONG'
    });
  }

  const validation = validateJobUrl(normalizedUrl);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
      code: 'INVALID_JOB_URL',
      platform: validation.platform
    });
  }

  // Add validation results to request object for use in controller
  req.validatedUrl = {
    url: normalizedUrl,
    platform: validation.platform,
    urlType: validation.urlType,
    warning: validation.warning || null
  };

  next();
};

/**
 * Get platform-specific parsing configuration
 * @param {string} platform - The platform name
 * @returns {Object} Platform configuration
 */
const getPlatformConfig = (platform) => {
  const config = SUPPORTED_PLATFORMS[platform];
  
  if (!config) {
    return {
      name: platform,
      selectors: {},
      waitTime: 3000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
  }

  // Platform-specific selectors and configuration
  const platformConfigs = {
    linkedin: {
      name: 'LinkedIn',
      selectors: {
        title: '.top-card-layout__title, .job-details-jobs-unified-top-card__job-title h1',
        company: '.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name a',
        location: '.topcard__flavor--bullet, .job-details-jobs-unified-top-card__primary-description-container div',
        description: '.description__text, .jobs-description__content div',
        requirements: '.description__text ul, .jobs-description__content ul'
      },
      waitTime: 2000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    indeed: {
      name: 'Indeed',
      selectors: {
        title: '[data-testid="jobsearch-JobInfoHeader-title"] span, .jobsearch-JobInfoHeader-title span',
        company: '[data-testid="inlineHeader-companyName"] a, .jobsearch-InlineCompanyRating > div > div > span',
        location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle > div:nth-child(2)',
        description: '#jobDescriptionText, .jobsearch-jobDescriptionText',
        requirements: '#jobDescriptionText ul, .jobsearch-jobDescriptionText ul'
      },
      waitTime: 1500,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    glassdoor: {
      name: 'Glassdoor',
      selectors: {
        title: '[data-test="job-title"], .e1tk4kwz4',
        company: '[data-test="employer-name"], .e1tk4kwz5',
        location: '[data-test="job-location"], .e1tk4kwz6',
        description: '[data-test="jobDescriptionContent"], .desc',
        requirements: '[data-test="jobDescriptionContent"] ul, .desc ul'
      },
      waitTime: 2500,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };

  return platformConfigs[platform] || platformConfigs.linkedin;
};

/**
 * Check if URL is accessible and not blocked
 * @param {string} url - URL to check
 * @returns {Promise<Object>} Accessibility check result
 */
const checkUrlAccessibility = async (url) => {
  try {
    const axios = require('axios');
    
    const response = await axios.head(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    return {
      accessible: true,
      statusCode: response.status,
      contentType: response.headers['content-type'] || '',
      error: null
    };
  } catch (error) {
    return {
      accessible: false,
      statusCode: error.response?.status || null,
      contentType: null,
      error: error.message
    };
  }
};

module.exports = {
  urlValidationMiddleware,
  validateJobUrl,
  getPlatformConfig,
  checkUrlAccessibility,
  SUPPORTED_PLATFORMS,
  COMPANY_CAREER_PATTERNS
};
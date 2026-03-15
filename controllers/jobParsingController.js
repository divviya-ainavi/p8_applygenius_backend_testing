import { Request, Response } from 'express';
import JobPosting from '../models/JobPosting.js';
import webScrapingService from '../services/webScrapingService.js';
import { validateJobUrl } from '../middleware/urlValidation.js';

interface ParsedJobData {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  requirements?: string[];
  salary?: string;
  employmentType?: string;
  postedDate?: Date;
  applicationUrl?: string;
}

interface JobParsingRequest extends Request {
  body: {
    url: string;
    userId?: string;
  };
}

export const parseJobFromUrl = async (req: JobParsingRequest, res: Response) => {
  try {
    const { url, userId } = req.body;

    if (!url) {
      return res.status(400).json({ 
        error: 'Job posting URL is required',
        success: false 
      });
    }

    // Validate URL format and supported platforms
    const urlValidation = validateJobUrl(url);
    if (!urlValidation.isValid) {
      return res.status(400).json({ 
        error: urlValidation.error || 'Invalid or unsupported job posting URL',
        success: false,
        supportedPlatforms: ['LinkedIn', 'Indeed', 'Glassdoor', 'Company Career Pages']
      });
    }

    // Check if this URL has been parsed before
    const existingJob = await JobPosting.findOne({ originalUrl: url });
    if (existingJob && existingJob.isValid) {
      return res.status(200).json({
        success: true,
        data: existingJob,
        cached: true,
        message: 'Job posting retrieved from cache'
      });
    }

    // Scrape and parse the job posting
    const scrapingResult = await webScrapingService.scrapeJobPosting(url);
    
    if (!scrapingResult.success) {
      return res.status(422).json({
        error: 'Failed to parse job posting',
        details: scrapingResult.error,
        success: false,
        fallbackRequired: true
      });
    }

    const parsedData: ParsedJobData = scrapingResult.data;

    // Validate extracted content
    const validationResult = validateParsedContent(parsedData);
    if (!validationResult.isValid) {
      return res.status(422).json({
        error: 'Extracted content validation failed',
        details: validationResult.errors,
        success: false,
        fallbackRequired: true,
        partialData: parsedData
      });
    }

    // Save parsed job posting to database
    const jobPosting = new JobPosting({
      originalUrl: url,
      title: parsedData.title,
      company: parsedData.company,
      location: parsedData.location,
      description: parsedData.description,
      requirements: parsedData.requirements || [],
      salary: parsedData.salary,
      employmentType: parsedData.employmentType,
      postedDate: parsedData.postedDate,
      applicationUrl: parsedData.applicationUrl || url,
      platform: urlValidation.platform,
      isValid: true,
      parsedAt: new Date(),
      parsedBy: userId,
      extractionMetadata: {
        method: scrapingResult.method,
        confidence: scrapingResult.confidence,
        selectors: scrapingResult.selectors
      }
    });

    const savedJob = await jobPosting.save();

    res.status(201).json({
      success: true,
      data: savedJob,
      cached: false,
      message: 'Job posting parsed and saved successfully'
    });

  } catch (error) {
    console.error('Job parsing error:', error);
    res.status(500).json({ 
      error: 'Internal server error during job parsing',
      success: false,
      fallbackRequired: true
    });
  }
};

export const getJobPosting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const jobPosting = await JobPosting.findById(id);
    if (!jobPosting) {
      return res.status(404).json({ 
        error: 'Job posting not found',
        success: false 
      });
    }

    res.status(200).json({
      success: true,
      data: jobPosting
    });

  } catch (error) {
    console.error('Error fetching job posting:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      success: false 
    });
  }
};

export const getUserJobPostings = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, platform, isValid } = req.query;

    const filter: any = { parsedBy: userId };
    
    if (platform) {
      filter.platform = platform;
    }
    
    if (isValid !== undefined) {
      filter.isValid = isValid === 'true';
    }

    const options = {
      skip: (Number(page) - 1) * Number(limit),
      limit: Number(limit),
      sort: { parsedAt: -1 }
    };

    const jobPostings = await JobPosting.find(filter, null, options);
    const total = await JobPosting.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: jobPostings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching user job postings:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      success: false 
    });
  }
};

export const updateJobPosting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating certain fields
    const allowedUpdates = [
      'title', 'company', 'location', 'description', 
      'requirements', 'salary', 'employmentType', 'notes'
    ];
    
    const updateData: any = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = updates[key];
      }
    });

    updateData.updatedAt = new Date();

    const jobPosting = await JobPosting.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!jobPosting) {
      return res.status(404).json({ 
        error: 'Job posting not found',
        success: false 
      });
    }

    res.status(200).json({
      success: true,
      data: jobPosting,
      message: 'Job posting updated successfully'
    });

  } catch (error) {
    console.error('Error updating job posting:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      success: false 
    });
  }
};

export const deleteJobPosting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const jobPosting = await JobPosting.findByIdAndDelete(id);
    if (!jobPosting) {
      return res.status(404).json({ 
        error: 'Job posting not found',
        success: false 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Job posting deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting job posting:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      success: false 
    });
  }
};

export const reParseJobPosting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingJob = await JobPosting.findById(id);
    if (!existingJob) {
      return res.status(404).json({ 
        error: 'Job posting not found',
        success: false 
      });
    }

    // Re-scrape the original URL
    const scrapingResult = await webScrapingService.scrapeJobPosting(existingJob.originalUrl);
    
    if (!scrapingResult.success) {
      return res.status(422).json({
        error: 'Failed to re-parse job posting',
        details: scrapingResult.error,
        success: false
      });
    }

    const parsedData: ParsedJobData = scrapingResult.data;
    const validationResult = validateParsedContent(parsedData);
    
    if (!validationResult.isValid) {
      return res.status(422).json({
        error: 'Re-parsed content validation failed',
        details: validationResult.errors,
        success: false,
        partialData: parsedData
      });
    }

    // Update existing job posting
    const updatedJob = await JobPosting.findByIdAndUpdate(
      id,
      {
        title: parsedData.title,
        company: parsedData.company,
        location: parsedData.location,
        description: parsedData.description,
        requirements: parsedData.requirements || [],
        salary: parsedData.salary,
        employmentType: parsedData.employmentType,
        postedDate: parsedData.postedDate,
        applicationUrl: parsedData.applicationUrl || existingJob.originalUrl,
        isValid: true,
        parsedAt: new Date(),
        extractionMetadata: {
          method: scrapingResult.method,
          confidence: scrapingResult.confidence,
          selectors: scrapingResult.selectors,
          reParsed: true
        }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedJob,
      message: 'Job posting re-parsed successfully'
    });

  } catch (error) {
    console.error('Error re-parsing job posting:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      success: false 
    });
  }
};

const validateParsedContent = (data: ParsedJobData): { isValid: boolean; errors?: string[] } => {
  const errors: string[] = [];

  if (!data.title || data.title.length < 3) {
    errors.push('Job title is missing or too short');
  }

  if (!data.company || data.company.length < 2) {
    errors.push('Company name is missing or too short');
  }

  if (!data.description || data.description.length < 50) {
    errors.push('Job description is missing or too short');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};
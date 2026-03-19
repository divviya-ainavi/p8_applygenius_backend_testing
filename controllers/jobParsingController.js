import { Request, Response } from 'express';
import JobPosting from '../models/JobPosting.js';
import jobScraperService from '../services/jobScraperService.js';
import jobParserService from '../services/jobParserService.js';

export const parseJobUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Job URL is required'
      });
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Check if job posting already exists
    const existingJob = await JobPosting.findOne({ url });
    if (existingJob) {
      return res.json({
        success: true,
        data: existingJob,
        cached: true
      });
    }

    // Scrape job content
    const scrapedContent = await jobScraperService.scrapeJobPosting(url);
    
    if (!scrapedContent) {
      return res.status(422).json({
        success: false,
        error: 'Failed to scrape job content. Please try manual entry.',
        fallback: true
      });
    }

    // Parse structured data
    const parsedData = await jobParserService.parseJobContent(scrapedContent, url);

    if (!parsedData) {
      return res.status(422).json({
        success: false,
        error: 'Failed to parse job data. Please try manual entry.',
        fallback: true
      });
    }

    // Save to database
    const jobPosting = new JobPosting({
      url,
      rawContent: scrapedContent.rawHtml,
      company: parsedData.company,
      title: parsedData.title,
      location: parsedData.location,
      description: parsedData.description,
      requirements: parsedData.requirements,
      skills: parsedData.skills,
      salary: parsedData.salary,
      employmentType: parsedData.employmentType,
      source: parsedData.source,
      postedDate: parsedData.postedDate,
      parsedAt: new Date(),
      isVerified: false
    });

    await jobPosting.save();

    res.status(201).json({
      success: true,
      data: jobPosting
    });

  } catch (error) {
    console.error('Error parsing job URL:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while parsing job URL'
    });
  }
};

export const verifyParsedJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { 
      company, 
      title, 
      location, 
      description, 
      requirements, 
      skills, 
      salary, 
      employmentType 
    } = req.body;

    const jobPosting = await JobPosting.findById(jobId);
    
    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        error: 'Job posting not found'
      });
    }

    // Update with verified data
    jobPosting.company = company || jobPosting.company;
    jobPosting.title = title || jobPosting.title;
    jobPosting.location = location || jobPosting.location;
    jobPosting.description = description || jobPosting.description;
    jobPosting.requirements = requirements || jobPosting.requirements;
    jobPosting.skills = skills || jobPosting.skills;
    jobPosting.salary = salary || jobPosting.salary;
    jobPosting.employmentType = employmentType || jobPosting.employmentType;
    jobPosting.isVerified = true;
    jobPosting.verifiedAt = new Date();

    await jobPosting.save();

    res.json({
      success: true,
      data: jobPosting
    });

  } catch (error) {
    console.error('Error verifying job posting:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while verifying job posting'
    });
  }
};

export const getSupportedPlatforms = async (req: Request, res: Response) => {
  try {
    const platforms = jobScraperService.getSupportedPlatforms();
    
    res.json({
      success: true,
      data: {
        platforms,
        count: platforms.length
      }
    });

  } catch (error) {
    console.error('Error getting supported platforms:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getJobPostingById = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const jobPosting = await JobPosting.findById(jobId);
    
    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        error: 'Job posting not found'
      });
    }

    res.json({
      success: true,
      data: jobPosting
    });

  } catch (error) {
    console.error('Error getting job posting:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getUserJobPostings = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const jobPostings = await JobPosting.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await JobPosting.countDocuments({ createdBy: userId });

    res.json({
      success: true,
      data: {
        jobPostings,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total
        }
      }
    });

  } catch (error) {
    console.error('Error getting user job postings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const deleteJobPosting = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const jobPosting = await JobPosting.findByIdAndDelete(jobId);
    
    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        error: 'Job posting not found'
      });
    }

    res.json({
      success: true,
      message: 'Job posting deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting job posting:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const validateJobUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const isValid = isValidUrl(url);
    const isSupported = jobScraperService.isPlatformSupported(url);

    res.json({
      success: true,
      data: {
        isValid,
        isSupported,
        platform: isSupported ? jobScraperService.detectPlatform(url) : null
      }
    });

  } catch (error) {
    console.error('Error validating job URL:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Helper function to validate URL format
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
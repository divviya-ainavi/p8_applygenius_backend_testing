const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

class WebScrapingService {
  constructor() {
    this.timeout = 10000;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    this.platforms = {
      'linkedin.com': this.parseLinkedIn.bind(this),
      'indeed.com': this.parseIndeed.bind(this),
      'glassdoor.com': this.parseGlassdoor.bind(this),
      'default': this.parseGeneric.bind(this)
    };
  }

  async scrapeJobPosting(url) {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent }
      });

      const parser = this.platforms[domain] || this.platforms.default;
      const jobData = await parser(response.data, url);
      
      return {
        success: true,
        data: {
          ...jobData,
          sourceUrl: url,
          scrapedAt: new Date(),
          platform: domain
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  parseLinkedIn(html, url) {
    const $ = cheerio.load(html);
    return {
      title: $('.top-card-layout__title').text().trim() || $('h1').first().text().trim(),
      company: $('.top-card-layout__card .topcard__flavor').text().trim() || $('.topcard__org-name-link').text().trim(),
      location: $('.top-card-layout__card .topcard__flavor--bullet').text().trim(),
      description: $('.show-more-less-html__markup').html() || $('.description__text').html(),
      requirements: this.extractRequirements($('.show-more-less-html__markup').text())
    };
  }

  parseIndeed(html, url) {
    const $ = cheerio.load(html);
    return {
      title: $('[data-testid="jobsearch-JobInfoHeader-title"]').text().trim() || $('h1').first().text().trim(),
      company: $('[data-testid="inlineHeader-companyName"]').text().trim(),
      location: $('[data-testid="job-location"]').text().trim(),
      description: $('#jobDescriptionText').html() || $('.jobsearch-jobDescriptionText').html(),
      requirements: this.extractRequirements($('#jobDescriptionText').text())
    };
  }

  parseGlassdoor(html, url) {
    const $ = cheerio.load(html);
    return {
      title: $('[data-test="job-title"]').text().trim() || $('h1').first().text().trim(),
      company: $('[data-test="employer-name"]').text().trim(),
      location: $('[data-test="job-location"]').text().trim(),
      description: $('#JobDescriptionContainer').html() || $('.jobDescriptionContent').html(),
      requirements: this.extractRequirements($('#JobDescriptionContainer').text())
    };
  }

  parseGeneric(html, url) {
    const $ = cheerio.load(html);
    const title = $('h1').first().text().trim() || 
                  $('[class*="title"], [class*="job-title"], [id*="title"]').first().text().trim();
    
    const description = $('[class*="description"], [class*="job-description"], [id*="description"]').html() ||
                       $('main').html() || $('.content').html();

    return {
      title,
      company: $('[class*="company"], [class*="employer"]').first().text().trim(),
      location: $('[class*="location"], [class*="address"]').first().text().trim(),
      description,
      requirements: this.extractRequirements($(description).text())
    };
  }

  extractRequirements(text) {
    if (!text) return [];
    const keywords = [
      'required', 'must have', 'experience', 'skills', 'qualifications',
      'requirements', 'preferred', 'years', 'degree', 'education'
    ];
    
    const sentences = text.split(/[.!?]\s+/);
    return sentences
      .filter(sentence => keywords.some(keyword => 
        sentence.toLowerCase().includes(keyword.toLowerCase())))
      .slice(0, 10)
      .map(req => req.trim())
      .filter(req => req.length > 10);
  }

  validateJobData(jobData) {
    const required = ['title', 'description'];
    const missing = required.filter(field => !jobData[field] || jobData[field].trim() === '');
    
    return {
      isValid: missing.length === 0,
      missing,
      completeness: Object.values(jobData).filter(Boolean).length / Object.keys(jobData).length
    };
  }

  getSupportedPlatforms() {
    return Object.keys(this.platforms).filter(platform => platform !== 'default');
  }

  isSupportedUrl(url) {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return this.getSupportedPlatforms().some(platform => domain.includes(platform));
    } catch {
      return false;
    }
  }
}

module.exports = new WebScrapingService();
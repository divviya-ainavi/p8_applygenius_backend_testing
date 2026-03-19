const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class JobScraperService {
  constructor() {
    this.browser = null;
    this.supportedSites = [
      'linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com',
      'ziprecruiter.com', 'careerbuilder.com', 'simplyhired.com',
      'dice.com', 'stackoverflow.com', 'angel.co'
    ];
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async scrapeJobPosting(url) {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      
      if (!this.supportedSites.some(site => domain.includes(site))) {
        throw new Error(`Unsupported job site: ${domain}`);
      }

      if (domain.includes('linkedin.com')) {
        return await this.scrapeLinkedIn(url);
      } else if (domain.includes('indeed.com')) {
        return await this.scrapeIndeed(url);
      } else {
        return await this.scrapeGeneric(url);
      }
    } catch (error) {
      console.error('Scraping failed:', error);
      throw new Error(`Failed to scrape job posting: ${error.message}`);
    }
  }

  async scrapeLinkedIn(url) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    const content = await page.evaluate(() => {
      const title = document.querySelector('.top-card-layout__title')?.textContent?.trim();
      const company = document.querySelector('.topcard__flavor')?.textContent?.trim();
      const location = document.querySelector('.topcard__flavor--bullet')?.textContent?.trim();
      const description = document.querySelector('.description__text')?.textContent?.trim();
      
      return { title, company, location, description, rawHtml: document.body.innerHTML };
    });

    await page.close();
    return content;
  }

  async scrapeIndeed(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      return {
        title: $('[data-testid="jobsearch-JobInfoHeader-title"]').text().trim(),
        company: $('[data-testid="inlineHeader-companyName"]').text().trim(),
        location: $('[data-testid="job-location"]').text().trim(),
        description: $('#jobDescriptionText').text().trim(),
        rawHtml: response.data
      };
    } catch (error) {
      return await this.scrapeWithPuppeteer(url);
    }
  }

  async scrapeGeneric(url) {
    return await this.scrapeWithPuppeteer(url);
  }

  async scrapeWithPuppeteer(url) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    const content = await page.evaluate(() => {
      const selectors = {
        title: ['h1', '[data-testid*="title"]', '.job-title', '.jobTitle'],
        company: ['[data-testid*="company"]', '.company', '.employer', '.companyName'],
        location: ['[data-testid*="location"]', '.location', '.jobLocation'],
        description: ['.job-description', '.description', '[data-testid*="description"]', '#jobDescriptionText']
      };

      const findBySelectors = (selectorArray) => {
        for (const selector of selectorArray) {
          const element = document.querySelector(selector);
          if (element) return element.textContent?.trim();
        }
        return null;
      };

      return {
        title: findBySelectors(selectors.title),
        company: findBySelectors(selectors.company),
        location: findBySelectors(selectors.location),
        description: findBySelectors(selectors.description),
        rawHtml: document.body.innerHTML
      };
    });

    await page.close();
    return content;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  validateUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      return this.supportedSites.some(site => domain.includes(site));
    } catch {
      return false;
    }
  }

  getSupportedSites() {
    return this.supportedSites;
  }
}

module.exports = new JobScraperService();
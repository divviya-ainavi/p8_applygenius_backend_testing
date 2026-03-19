const cheerio = require('cheerio');

class JobParserService {
  constructor() {
    this.parsers = {
      'linkedin.com': this.parseLinkedIn.bind(this),
      'indeed.com': this.parseIndeed.bind(this),
      'glassdoor.com': this.parseGlassdoor.bind(this),
      'monster.com': this.parseMonster.bind(this),
      'ziprecruiter.com': this.parseZipRecruiter.bind(this),
      'careerbuilder.com': this.parseCareerBuilder.bind(this),
      'simplyhired.com': this.parseSimplyHired.bind(this),
      'dice.com': this.parseDice.bind(this),
      'stackoverflow.com': this.parseStackOverflow.bind(this),
      'angellist.com': this.parseAngelList.bind(this)
    };
  }

  parseJobContent(html, url) {
    const domain = this.extractDomain(url);
    const parser = this.parsers[domain] || this.parseGeneric.bind(this);
    
    try {
      return parser(html, url);
    } catch (error) {
      console.error(`Parsing failed for ${domain}:`, error);
      return this.parseGeneric(html, url);
    }
  }

  extractDomain(url) {
    return new URL(url).hostname.replace('www.', '');
  }

  parseLinkedIn(html) {
    const $ = cheerio.load(html);
    return {
      title: $('.top-card-layout__title').text().trim(),
      company: $('.topcard__flavor--black-link').text().trim(),
      location: $('.topcard__flavor--bullet').first().text().trim(),
      description: $('.description__text').text().trim(),
      requirements: this.extractRequirements($('.description__text').text()),
      skills: this.extractSkills($('.description__text').text()),
      jobType: $('.description__job-criteria-item').filter((i, el) => $(el).find('h3').text().includes('Employment type')).find('span').text().trim()
    };
  }

  parseIndeed(html) {
    const $ = cheerio.load(html);
    return {
      title: $('.jobsearch-JobInfoHeader-title').text().trim(),
      company: $('[data-testid="inlineHeader-companyName"]').text().trim(),
      location: $('[data-testid="job-location"]').text().trim(),
      description: $('#jobDescriptionText').text().trim(),
      requirements: this.extractRequirements($('#jobDescriptionText').text()),
      skills: this.extractSkills($('#jobDescriptionText').text()),
      salary: $('.icl-u-xs-mr--xs').text().trim()
    };
  }

  parseGlassdoor(html) {
    const $ = cheerio.load(html);
    return {
      title: $('.strong').first().text().trim(),
      company: $('.link').first().text().trim(),
      location: $('.loc').text().trim(),
      description: $('.jobDescriptionContent').text().trim(),
      requirements: this.extractRequirements($('.jobDescriptionContent').text()),
      skills: this.extractSkills($('.jobDescriptionContent').text())
    };
  }

  parseGeneric(html) {
    const $ = cheerio.load(html);
    const text = $('body').text();
    
    return {
      title: this.extractTitle($),
      company: this.extractCompany($),
      location: this.extractLocation($),
      description: this.extractDescription($),
      requirements: this.extractRequirements(text),
      skills: this.extractSkills(text),
      salary: this.extractSalary($)
    };
  }

  extractTitle($) {
    const selectors = ['h1', '.job-title', '.title', '[class*="title"]'];
    for (const sel of selectors) {
      const text = $(sel).first().text().trim();
      if (text && text.length < 200) return text;
    }
    return '';
  }

  extractCompany($) {
    const selectors = ['.company', '[class*="company"]', '.employer'];
    for (const sel of selectors) {
      const text = $(sel).first().text().trim();
      if (text && text.length < 100) return text;
    }
    return '';
  }

  extractDescription($) {
    const selectors = ['.description', '[class*="description"]', '.job-description'];
    for (const sel of selectors) {
      const text = $(sel).first().text().trim();
      if (text && text.length > 100) return text;
    }
    return $('body').text().substring(0, 2000);
  }

  extractRequirements(text) {
    const reqPatterns = [
      /requirements?[:\s]+(.*?)(?=\n\n|\npreferred|skills|benefits)/gis,
      /qualifications?[:\s]+(.*?)(?=\n\n|\npreferred|skills|benefits)/gis,
      /must have[:\s]+(.*?)(?=\n\n|\npreferred|skills|benefits)/gis
    ];
    
    for (const pattern of reqPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim().split('\n').filter(r => r.trim()).slice(0, 10);
    }
    return [];
  }

  extractSkills(text) {
    const skillPatterns = [
      /\b(?:JavaScript|Python|Java|React|Node\.js|SQL|AWS|Docker|Kubernetes|Git)\b/gi,
      /\b(?:HTML|CSS|TypeScript|Angular|Vue|MongoDB|PostgreSQL|Redis|Linux)\b/gi
    ];
    
    const skills = new Set();
    skillPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(skill => skills.add(skill.toLowerCase()));
    });
    
    return Array.from(skills).slice(0, 15);
  }

  // Additional parsers for other job boards
  parseMonster(html) { return this.parseGeneric(html); }
  parseZipRecruiter(html) { return this.parseGeneric(html); }
  parseCareerBuilder(html) { return this.parseGeneric(html); }
  parseSimplyHired(html) { return this.parseGeneric(html); }
  parseDice(html) { return this.parseGeneric(html); }
  parseStackOverflow(html) { return this.parseGeneric(html); }
  parseAngelList(html) { return this.parseGeneric(html); }
  
  extractLocation($) {
    const selectors = ['.location', '[class*="location"]', '.loc'];
    for (const sel of selectors) {
      const text = $(sel).first().text().trim();
      if (text && text.length < 100) return text;
    }
    return '';
  }

  extractSalary($) {
    const text = $('body').text();
    const salaryMatch = text.match(/\$[\d,]+(?: *- *\$[\d,]+)?(?:\s*(?:per|\/)\s*(?:year|hour|month))?/i);
    return salaryMatch ? salaryMatch[0] : '';
  }

  validateParsedData(data) {
    return {
      ...data,
      title: data.title || 'Title not found',
      company: data.company || 'Company not found',
      description: data.description || 'Description not available',
      requirements: Array.isArray(data.requirements) ? data.requirements : [],
      skills: Array.isArray(data.skills) ? data.skills : [],
      location: data.location || '',
      salary: data.salary || ''
    };
  }
}

module.exports = new JobParserService();
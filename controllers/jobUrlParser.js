const axios = require('axios');
const cheerio = require('cheerio');

const SUPPORTED_DOMAINS = ['linkedin.com', 'indeed.com', 'glassdoor.com'];

const parseJobUrl = async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: 'URL is required' });
  }

  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return res.status(400).json({ message: 'Invalid URL format' });
  }

  const isSupported = SUPPORTED_DOMAINS.some((domain) => hostname.includes(domain));
  if (!isSupported) {
    return res.status(400).json({
      message: 'Only LinkedIn, Indeed, and Glassdoor URLs are currently supported',
    });
  }

  let html;
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 15000,
    });
    html = response.data;
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 429) {
      return res.status(503).json({
        message:
          'The job board is blocking automated access. Please copy and paste the job description manually.',
      });
    }
    console.error('Job URL fetch error:', err.message);
    return res.status(500).json({
      message: 'Failed to fetch the job posting. Please try manual entry.',
    });
  }

  try {
    const $ = cheerio.load(html);

    let jobTitle = '';
    let companyName = '';
    let location = '';
    let fullDescription = '';
    const requirements = [];

    if (hostname.includes('linkedin.com')) {
      jobTitle =
        $('.top-card-layout__title').first().text().trim() ||
        $('h1.job-title').first().text().trim() ||
        $('h1').first().text().trim();

      companyName =
        $('.top-card-layout__company-url').first().text().trim() ||
        $('[class*="company-name"]').first().text().trim() ||
        $('a[data-tracking-control-name="public_jobs_topcard-org-name"]').first().text().trim();

      location =
        $('.top-card-layout__bullet').first().text().trim() ||
        $('[class*="job-location"]').first().text().trim();

      fullDescription =
        $('.job-details__description').text().trim() ||
        $('.description__text').text().trim() ||
        $('[class*="description"]').first().text().trim();
    } else if (hostname.includes('indeed.com')) {
      jobTitle =
        $('h1.jobTitle').first().text().trim() ||
        $('[data-testid="jobsearch-JobInfoHeader-title"]').first().text().trim() ||
        $('h1').first().text().trim();

      companyName =
        $('[data-testid="inlineHeader-companyName"]').first().text().trim() ||
        $('[class*="companyName"]').first().text().trim();

      location =
        $('[data-testid="job-location"]').first().text().trim() ||
        $('[class*="companyLocation"]').first().text().trim();

      fullDescription =
        $('#jobDescriptionText').text().trim() ||
        $('.jobsearch-jobDescriptionText').text().trim();
    } else if (hostname.includes('glassdoor.com')) {
      jobTitle =
        $('[data-test="job-title"]').first().text().trim() ||
        $('.job-title').first().text().trim() ||
        $('h1').first().text().trim();

      companyName =
        $('[data-test="employer-name"]').first().text().trim() ||
        $('.employer-name').first().text().trim();

      location =
        $('[data-test="job-location"]').first().text().trim() ||
        $('.location').first().text().trim();

      fullDescription =
        $('.JobDetails_jobDescription__uW_fK').text().trim() ||
        $('.job-description').text().trim() ||
        $('[class*="jobDescription"]').first().text().trim();
    }

    // Fallback: grab body text if description is empty
    if (!fullDescription) {
      $('script, style, nav, header, footer').remove();
      fullDescription = $('body').text().replace(/\s{2,}/g, ' ').trim().substring(0, 6000);
    }

    // Extract bullet-point requirements from the description section
    $('ul li').each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 15 && text.length < 400) {
        requirements.push(text);
      }
    });

    return res.json({
      jobTitle: jobTitle || '',
      companyName: companyName || '',
      location: location || '',
      requirements: requirements.slice(0, 25),
      qualifications: [],
      fullDescription: fullDescription || '',
    });
  } catch (err) {
    console.error('Job URL parsing error:', err.message);
    return res.status(500).json({
      message: 'Failed to parse the job posting content. Please try manual entry.',
    });
  }
};

module.exports = { parseJobUrl };

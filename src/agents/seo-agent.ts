import axios from 'axios';
import { load } from 'cheerio';
import type { CheckResult, Finding, PlatformConfig } from '../types';

export class SeoAgent {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  async run(): Promise<CheckResult> {
    const findings: Finding[] = [];
    const baseUrl = this.config.baseUrl.replace('/api/', '');

    try {
      const [
        sitemapFindings,
        robotsFindings,
        metaFindings,
        schemaFindings,
      ] = await Promise.all([
        this.checkSitemap(baseUrl),
        this.checkRobotsTxt(baseUrl),
        this.checkMetaTags(baseUrl),
        this.checkSchemaMarkup(baseUrl),
      ]);

      findings.push(...sitemapFindings, ...robotsFindings, ...metaFindings, ...schemaFindings);

      const errors = findings.filter((f) => f.type === 'error').length;
      const warnings = findings.filter((f) => f.type === 'warning').length;

      let status: 'ok' | 'warning' | 'critical' = 'ok';
      let score = 100;

      if (errors > 0) {
        status = errors >= 3 ? 'critical' : 'warning';
        score -= errors * 15;
      }
      if (warnings > 0) {
        status = status === 'ok' && warnings >= 4 ? 'warning' : status;
        score -= warnings * 5;
      }

      score = Math.max(0, score);

      return {
        agent: 'seo',
        status,
        score,
        findings,
      };
    } catch (error) {
      return {
        agent: 'seo',
        status: 'critical',
        score: 0,
        findings: [{ type: 'error', message: `SEO check failed: ${error}` }],
      };
    }
  }

  private async checkSitemap(baseUrl: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const response = await axios.get(`${baseUrl}/sitemap.xml`, {
        timeout: 5000,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        const $ = load(response.data, { xmlMode: true });
        const urls = $('url loc').length;
        const lastmod = $('url lastmod').first().text();

        if (urls === 0) {
          findings.push({
            type: 'error',
            message: 'Sitemap is empty',
            location: '/sitemap.xml',
          });
        } else {
          if (urls > 50000) {
            findings.push({
              type: 'warning',
              message: `Sitemap has ${urls} URLs (exceeds 50k limit)`,
              location: '/sitemap.xml',
            });
          } else {
            findings.push({
              type: 'info',
              message: `Sitemap OK: ${urls} URLs`,
              location: '/sitemap.xml',
            });
          }

          if (lastmod) {
            const modDate = new Date(lastmod);
            const daysAgo = Math.floor((Date.now() - modDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo > 7) {
              findings.push({
                type: 'warning',
                message: `Sitemap not updated in ${daysAgo} days`,
                location: '/sitemap.xml',
              });
            }
          }
        }
      } else {
        findings.push({
          type: 'error',
          message: `Sitemap returned status ${response.status}`,
          location: '/sitemap.xml',
        });
      }
    } catch {
      findings.push({
        type: 'error',
        message: 'Sitemap.xml not found or not accessible',
        location: '/sitemap.xml',
      });
    }

    return findings;
  }

  private async checkRobotsTxt(baseUrl: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const response = await axios.get(`${baseUrl}/robots.txt`, {
        timeout: 5000,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        const content: string = response.data;

        if (content.includes('Disallow: /')) {
          findings.push({
            type: 'error',
            message: 'robots.txt blocks entire site',
            location: '/robots.txt',
          });
        } else if (content.includes('Disallow: /api/')) {
          findings.push({
            type: 'warning',
            message: 'robots.txt blocks /api/ directory',
            location: '/robots.txt',
          });
        }

        const sitemapMatch = content.match(/Sitemap:\s*(.+)/i);
        if (sitemapMatch) {
          findings.push({
            type: 'info',
            message: 'Sitemap declared in robots.txt',
            location: '/robots.txt',
          });
        } else {
          findings.push({
            type: 'warning',
            message: 'No Sitemap directive in robots.txt',
            location: '/robots.txt',
          });
        }
      } else {
        findings.push({
          type: 'error',
          message: `robots.txt returned status ${response.status}`,
          location: '/robots.txt',
        });
      }
    } catch {
      findings.push({
        type: 'error',
        message: 'robots.txt not found',
        location: '/robots.txt',
      });
    }

    return findings;
  }

  private async checkMetaTags(baseUrl: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const response = await axios.get(baseUrl, { timeout: 10000 });
      const $ = load(response.data);

      const title = $('title').text().trim();
      const description = $('meta[name="description"]').attr('content') || '';
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');
      const h1Count = $('h1').length;
      const h2Count = $('h2').length;

      if (!title) {
        findings.push({
          type: 'error',
          message: 'Page title is missing',
          location: '<title>',
        });
      } else if (title.length < 30) {
        findings.push({
          type: 'warning',
          message: 'Page title is too short (< 30 chars)',
          location: '<title>',
        });
      } else if (title.length > 60) {
        findings.push({
          type: 'warning',
          message: 'Page title is too long (> 60 chars)',
          location: '<title>',
        });
      }

      if (!description) {
        findings.push({
          type: 'error',
          message: 'Meta description is missing',
          location: 'meta[name="description"]',
        });
      } else if (description.length < 120) {
        findings.push({
          type: 'warning',
          message: 'Meta description is too short (< 120 chars)',
          location: 'meta[name="description"]',
        });
      } else if (description.length > 160) {
        findings.push({
          type: 'warning',
          message: 'Meta description is too long (> 160 chars)',
          location: 'meta[name="description"]',
        });
      }

      if (!ogTitle) {
        findings.push({
          type: 'warning',
          message: 'Open Graph title is missing',
          location: 'meta[property="og:title"]',
        });
      }

      if (!ogDescription) {
        findings.push({
          type: 'warning',
          message: 'Open Graph description is missing',
          location: 'meta[property="og:description"]',
        });
      }

      if (h1Count === 0) {
        findings.push({
          type: 'error',
          message: 'No H1 tag found',
          location: 'h1',
        });
      } else if (h1Count > 1) {
        findings.push({
          type: 'warning',
          message: `Multiple H1 tags found (${h1Count})`,
          location: 'h1',
        });
      }

      if (h2Count === 0) {
        findings.push({
          type: 'info',
          message: 'No H2 tags found',
          location: 'h2',
        });
      }

      const imagesWithoutAlt = $('img:not([alt])').length;
      if (imagesWithoutAlt > 0) {
        findings.push({
          type: 'warning',
          message: `${imagesWithoutAlt} images without alt text`,
          location: 'img[alt]',
        });
      }

      const canonical = $('link[rel="canonical"]').attr('href');
      if (!canonical) {
        findings.push({
          type: 'warning',
          message: 'Canonical tag is missing',
          location: 'link[rel="canonical"]',
        });
      }
    } catch (error) {
      findings.push({
        type: 'error',
        message: `Failed to scrape meta tags: ${error}`,
      });
    }

    return findings;
  }

  private async checkSchemaMarkup(baseUrl: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const response = await axios.get(baseUrl, { timeout: 10000 });
      const $ = load(response.data);

      const schemaScripts = $('script[type="application/ld+json"]');

      if (schemaScripts.length === 0) {
        findings.push({
          type: 'error',
          message: 'No Schema.org markup found',
          location: 'script[type="application/ld+json"]',
        });
      } else {
        let hasOrganization = false;
        let hasProduct = false;
        let hasBreadcrumb = false;

        schemaScripts.each((_, elem) => {
          const content = $(elem).html() || '';
          if (content.includes('"@type":"Organization"') || content.includes('"@type":"WebSite"')) {
            hasOrganization = true;
          }
          if (content.includes('"@type":"Product"')) {
            hasProduct = true;
          }
          if (content.includes('"@type":"BreadcrumbList"')) {
            hasBreadcrumb = true;
          }
        });

        if (!hasOrganization) {
          findings.push({
            type: 'warning',
            message: 'No Organization/WebSite schema found',
            location: 'script[type="application/ld+json"]',
          });
        } else {
          findings.push({
            type: 'info',
            message: 'Organization/WebSite schema found',
            location: 'script[type="application/ld+json"]',
          });
        }

        if (!hasProduct) {
          findings.push({
            type: 'info',
            message: 'No Product schema found (not required for all pages)',
            location: 'script[type="application/ld+json"]',
          });
        }

        if (!hasBreadcrumb) {
          findings.push({
            type: 'info',
            message: 'No BreadcrumbList schema found',
            location: 'script[type="application/ld+json"]',
          });
        }
      }
    } catch (error) {
      findings.push({
        type: 'error',
        message: `Failed to check schema markup: ${error}`,
      });
    }

    return findings;
  }
}
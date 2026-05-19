import axios, { AxiosInstance } from 'axios';
import { load } from 'cheerio';
import type { PlatformConfig, Finding } from '../types';

interface PrestaShopProduct {
  id: number;
  name: string;
  price: string;
  reference: string;
  active: number;
}

interface PrestaShopShopInfo {
  name: string;
  email: string;
  version: string;
}

export class PrestaShopAdapter {
  private client: AxiosInstance;
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 10000,
      auth: {
        username: config.apiKey,
        password: '',
      },
    });
  }

  async getShopInfo(): Promise<PrestaShopShopInfo> {
    try {
      const response = await this.client.get('/');
      const $ = load(response.data);
      return {
        name: $('shop name').text() || 'Unknown',
        email: $('shop email').text() || 'Unknown',
        version: $('shop version').text() || 'Unknown',
      };
    } catch (error) {
      throw new Error(`Failed to get shop info: ${error}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/products?output_format=JSON&display=full&limit=1');
      return true;
    } catch {
      return false;
    }
  }

  async getProducts(limit = 100): Promise<PrestaShopProduct[]> {
    try {
      const response = await this.client.get(
        `/products?output_format=JSON&display=full&limit=${limit}`
      );
      return response.data.products;
    } catch (error) {
      throw new Error(`Failed to get products: ${error}`);
    }
  }

  async getCategories(): Promise<unknown[]> {
    try {
      const response = await this.client.get(
        '/categories?output_format=JSON&display=full'
      );
      return response.data.categories;
    } catch (error) {
      throw new Error(`Failed to get categories: ${error}`);
    }
  }

  async scrapeMetaTags(): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
      const response = await axios.get(this.config.baseUrl.replace('/api/', ''));
      const $ = load(response.data);
      
      const title = $('title').text();
      const description = $('meta[name="description"]').attr('content');
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');
      
      if (!title || title.length < 10) {
        findings.push({
          type: 'error',
          message: 'Page title is missing or too short',
          location: '<title>',
        });
      }
      
      if (!description || description.length < 50) {
        findings.push({
          type: 'warning',
          message: 'Meta description is missing or too short',
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
      
      const h1Count = $('h1').length;
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
      
      const imagesWithoutAlt = $('img:not([alt])').length;
      if (imagesWithoutAlt > 0) {
        findings.push({
          type: 'warning',
          message: `${imagesWithoutAlt} images without alt text`,
          location: 'img',
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

  async checkSitemap(): Promise<Finding[]> {
    const findings: Finding[] = [];
    const baseUrl = this.config.baseUrl.replace('/api/', '');
    
    try {
      const response = await axios.get(`${baseUrl}/sitemap.xml`, { timeout: 5000 });
      
      if (response.status === 200) {
        const $ = load(response.data, { xmlMode: true });
        const urls = $('url loc').length;
        
        if (urls === 0) {
          findings.push({
            type: 'error',
            message: 'Sitemap is empty or has no URLs',
            location: '/sitemap.xml',
          });
        } else if (urls > 50000) {
          findings.push({
            type: 'warning',
            message: `Sitemap has ${urls} URLs (limit is 50,000)`,
            location: '/sitemap.xml',
          });
        } else {
          findings.push({
            type: 'info',
            message: `Sitemap found with ${urls} URLs`,
            location: '/sitemap.xml',
          });
        }
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

  async checkRobotsTxt(): Promise<Finding[]> {
    const findings: Finding[] = [];
    const baseUrl = this.config.baseUrl.replace('/api/', '');
    
    try {
      const response = await axios.get(`${baseUrl}/robots.txt`, { timeout: 5000 });
      
      if (response.status === 200) {
        const content = response.data;
        
        if (content.includes('Disallow: /api/')) {
          findings.push({
            type: 'warning',
            message: 'robots.txt blocks /api/ directory',
            location: '/robots.txt',
          });
        }
        
        if (content.includes('Disallow: /')) {
          findings.push({
            type: 'warning',
            message: 'robots.txt blocks entire site',
            location: '/robots.txt',
          });
        }
        
        findings.push({
          type: 'info',
          message: 'robots.txt found and accessible',
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

  async checkSchemaMarkup(): Promise<Finding[]> {
    const findings: Finding[] = [];
    const baseUrl = this.config.baseUrl.replace('/api/', '');
    
    try {
      const response = await axios.get(baseUrl);
      const $ = load(response.data);
      
      const schemaScripts = $('script[type="application/ld+json"]');
      
      if (schemaScripts.length === 0) {
        findings.push({
          type: 'warning',
          message: 'No Schema.org markup found',
          location: 'head',
        });
      } else {
        let hasOrganization = false;
        let hasProduct = false;
        
        schemaScripts.each((_, elem) => {
          const content = $(elem).html() || '';
          if (content.includes('"@type":"Organization"') || content.includes('"@type":"WebSite"')) {
            hasOrganization = true;
          }
          if (content.includes('"@type":"Product"')) {
            hasProduct = true;
          }
        });
        
        if (!hasOrganization) {
          findings.push({
            type: 'warning',
            message: 'No Organization/WebSite schema found',
            location: 'script[type="application/ld+json"]',
          });
        }
        
        if (!hasProduct) {
          findings.push({
            type: 'info',
            message: 'No Product schema found',
            location: 'script[type="application/ld+json"]',
          });
        } else {
          findings.push({
            type: 'info',
            message: 'Product schema found',
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
import axios from 'axios';
import { load } from 'cheerio';
import type { CheckResult, Finding, PlatformConfig } from '../types';

interface PageSpeedResult {
  lighthouseResult?: {
    categories?: {
      performance?: { score: number };
    };
    audits?: Record<string, { score?: number; numericValue?: number }>;
  };
}

export class WpoAgent {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  async run(): Promise<CheckResult> {
    const findings: Finding[] = [];
    const baseUrl = this.config.baseUrl.replace('/api/', '');

    try {
      const [pageSpeedResult, frontendResult] = await Promise.all([
        this.checkPageSpeed(baseUrl),
        this.checkFrontendPerformance(baseUrl),
      ]);

      findings.push(...pageSpeedResult.findings, ...frontendResult.findings);

      const errors = findings.filter((f) => f.type === 'error').length;
      const warnings = findings.filter((f) => f.type === 'warning').length;

      let status: 'ok' | 'warning' | 'critical' = 'ok';
      let score = pageSpeedResult.score;

      if (pageSpeedResult.score < 50) {
        status = 'critical';
      } else if (pageSpeedResult.score < 75 || errors >= 3) {
        status = 'warning';
      }

      return {
        agent: 'wpo',
        status,
        score,
        findings,
        metadata: {
          lighthouse: pageSpeedResult.metadata,
        },
      };
    } catch (error) {
      return {
        agent: 'wpo',
        status: 'critical',
        score: 0,
        findings: [{ type: 'error', message: `WPO check failed: ${error}` }],
      };
    }
  }

  private async checkPageSpeed(baseUrl: string): Promise<{
    findings: Finding[];
    score: number;
    metadata?: Record<string, unknown>;
  }> {
    const findings: Finding[] = [];
    let score = 50;
    let metadata: Record<string, unknown> = {};

    try {
      const strategy = 'mobile';
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(baseUrl)}&strategy=${strategy}&key=`;

      const response = await axios.get(apiUrl, { timeout: 30000 });
      const data: PageSpeedResult = response.data;

      if (data.lighthouseResult?.categories?.performance?.score !== undefined) {
        score = Math.round(data.lighthouseResult.categories.performance.score * 100);
        metadata = {
          performanceScore: score,
          strategy,
        };
      }

      const audits = data.lighthouseResult?.audits || {};

      const lcp = audits['largest-contentful-paint'];
      if (lcp?.numericValue) {
        const lcpMs = lcp.numericValue as number;
        metadata.lcp = Math.round(lcpMs);
        if (lcpMs > 4000) {
          findings.push({
            type: 'error',
            message: `LCP is ${Math.round(lcpMs / 1000)}s (target: < 2.5s)`,
            location: 'LCP',
          });
        } else if (lcpMs > 2500) {
          findings.push({
            type: 'warning',
            message: `LCP is ${Math.round(lcpMs / 1000)}s (target: < 2.5s)`,
            location: 'LCP',
          });
        } else {
          findings.push({
            type: 'info',
            message: `LCP is ${Math.round(lcpMs / 1000)}s (good)`,
            location: 'LCP',
          });
        }
      }

      const cls = audits['cumulative-layout-shift'];
      if (cls?.numericValue) {
        const clsValue = cls.numericValue as number;
        metadata.cls = Math.round(clsValue * 100) / 100;
        if (clsValue > 0.25) {
          findings.push({
            type: 'error',
            message: `CLS is ${clsValue} (target: < 0.1)`,
            location: 'CLS',
          });
        } else if (clsValue > 0.1) {
          findings.push({
            type: 'warning',
            message: `CLS is ${clsValue} (target: < 0.1)`,
            location: 'CLS',
          });
        } else {
          findings.push({
            type: 'info',
            message: `CLS is ${clsValue} (good)`,
            location: 'CLS',
          });
        }
      }

      const fid = audits['max-interaction-time'] || audits['total-blocking-time'];
      if (fid?.numericValue) {
        const fidMs = fid.numericValue as number;
        metadata.inp = Math.round(fidMs);
        if (fidMs > 300) {
          findings.push({
            type: 'warning',
            message: `INP/TBT is ${Math.round(fidMs)}ms (target: < 200ms)`,
            location: 'INP',
          });
        } else {
          findings.push({
            type: 'info',
            message: `INP/TBT is ${Math.round(fidMs)}ms (good)`,
            location: 'INP',
          });
        }
      }

      const renderBlocking = audits['render-blocking-resources'];
      if (renderBlocking?.score !== undefined && renderBlocking.score < 1) {
        findings.push({
          type: 'warning',
          message: 'Render-blocking resources detected',
          location: 'render-blocking-resources',
        });
      }

      const usesOptimizedImages = audits['uses-optimized-images'];
      if (usesOptimizedImages?.score !== undefined && usesOptimizedImages.score < 1) {
        findings.push({
          type: 'warning',
          message: 'Images could be optimized better',
          location: 'uses-optimized-images',
        });
      }

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        findings.push({
          type: 'warning',
          message: 'PageSpeed API requires authentication (using fallback)',
          location: 'PageSpeed API',
        });
        score = 50;
      } else {
        findings.push({
          type: 'warning',
          message: `PageSpeed API unavailable: ${error}`,
          location: 'PageSpeed API',
        });
        score = 40;
      }
    }

    return { findings, score, metadata };
  }

  private async checkFrontendPerformance(baseUrl: string): Promise<{ findings: Finding[]; score: number }> {
    const findings: Finding[] = [];
    let score = 100;

    try {
      const response = await axios.get(baseUrl, { timeout: 10000 });
      const $ = load(response.data);

      const scripts = $('script[src]');
      const stylesheets = $('link[rel="stylesheet"]');

      const blockingScripts = scripts.filter((_, el) => {
        const asyncAttr = $(el).attr('async');
        const deferAttr = $(el).attr('defer');
        return !asyncAttr && !deferAttr;
      });

      if (blockingScripts.length > 3) {
        findings.push({
          type: 'warning',
          message: `${blockingScripts.length} render-blocking scripts found`,
          location: 'script[src]',
        });
        score -= 10;
      }

      if (stylesheets.length > 5) {
        findings.push({
          type: 'warning',
          message: `${stylesheets.length} stylesheets found (consider bundling)`,
          location: 'link[rel="stylesheet"]',
        });
        score -= 5;
      }

      const largeImages = $('img').filter((_, el) => {
        const src = $(el).attr('src') || '';
        return src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png');
      });

      if (largeImages.length > 10) {
        findings.push({
          type: 'info',
          message: `${largeImages.length} images detected (ensure optimized)`,
          location: 'img[src]',
        });
      }

      const inlineStyles = $('style').length;
      if (inlineStyles > 5) {
        findings.push({
          type: 'info',
          message: `${inlineStyles} inline style blocks (consider external CSS)`,
          location: 'style',
        });
      }

      const metaViewport = $('meta[name="viewport"]').attr('content') || '';
      if (!metaViewport.includes('width=device-width')) {
        findings.push({
          type: 'warning',
          message: 'Viewport meta tag may not be properly configured',
          location: 'meta[name="viewport"]',
        });
        score -= 5;
      }

    } catch (error) {
      findings.push({
        type: 'error',
        message: `Failed to check frontend performance: ${error}`,
      });
      score = 30;
    }

    return { findings, score: Math.max(0, score) };
  }
}
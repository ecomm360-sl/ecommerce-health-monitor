import axios from 'axios';
import { load } from 'cheerio';
import net from 'net';
import tls from 'tls';
import type { CheckResult, Finding, PlatformConfig } from '../types';

interface SslInfo {
  valid: boolean;
  daysUntilExpiry?: number;
  grade?: string;
}

export class UptimeAgent {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  async run(): Promise<CheckResult> {
    const findings: Finding[] = [];
    const baseUrl = this.config.baseUrl.replace('/api/', '');

    try {
      const [httpCheck, sslCheck, responseTimeCheck] = await Promise.all([
        this.checkHttpStatus(baseUrl),
        this.checkSsl(baseUrl),
        this.checkResponseTime(baseUrl),
      ]);

      findings.push(...httpCheck.findings, ...sslCheck.findings, ...responseTimeCheck.findings);

      let status: 'ok' | 'warning' | 'critical' = 'ok';
      let score = 100;

      const errors = findings.filter((f) => f.type === 'error').length;
      const warnings = findings.filter((f) => f.type === 'warning').length;

      if (errors > 0) {
        status = 'critical';
        score = 0;
      } else if (warnings > 0) {
        status = warnings >= 2 ? 'critical' : 'warning';
        score = 100 - warnings * 20;
      }

      return {
        agent: 'uptime',
        status,
        score,
        findings,
        metadata: {
          responseTime: responseTimeCheck.metadata,
          ssl: sslCheck.metadata,
        },
      };
    } catch (error) {
      return {
        agent: 'uptime',
        status: 'critical',
        score: 0,
        findings: [{ type: 'error', message: `Uptime check failed: ${error}` }],
      };
    }
  }

  private async checkHttpStatus(baseUrl: string): Promise<{ findings: Finding[]; metadata?: Record<string, unknown> }> {
    const findings: Finding[] = [];
    const startTime = Date.now();

    try {
      const response = await axios.get(baseUrl, {
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 400,
        maxRedirects: 5,
      });

      const statusCode = response.status;
      const responseTime = Date.now() - startTime;

      findings.push({
        type: 'info',
        message: `HTTP ${statusCode} - Response time: ${responseTime}ms`,
        location: baseUrl,
      });

      if (statusCode !== 200) {
        findings.push({
          type: 'error',
          message: `Unexpected status code: ${statusCode}`,
          location: baseUrl,
        });
      }

      return { findings, metadata: { statusCode, responseTime } };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          findings.push({
            type: 'error',
            message: 'Connection refused',
            location: baseUrl,
          });
        } else if (error.code === 'ENOTFOUND') {
          findings.push({
            type: 'error',
            message: 'Domain not found',
            location: baseUrl,
          });
        } else if (error.code === 'ETIMEDOUT') {
          findings.push({
            type: 'error',
            message: 'Connection timeout',
            location: baseUrl,
          });
        } else {
          findings.push({
            type: 'error',
            message: `HTTP check failed: ${error.message}`,
            location: baseUrl,
          });
        }
      } else {
        findings.push({
          type: 'error',
          message: `Unknown error during HTTP check`,
          location: baseUrl,
        });
      }

      return { findings };
    }
  }

  private async checkSsl(baseUrl: string): Promise<{ findings: Finding[]; metadata?: Record<string, unknown> }> {
    const findings: Finding[] = [];
    const hostname = new URL(baseUrl).hostname;

    try {
      const sslInfo = await this.getSslInfo(hostname);

      if (sslInfo.daysUntilExpiry !== undefined) {
        if (sslInfo.daysUntilExpiry < 0) {
          findings.push({
            type: 'error',
            message: `SSL certificate expired ${Math.abs(sslInfo.daysUntilExpiry)} days ago`,
            location: `SSL:${hostname}`,
          });
        } else if (sslInfo.daysUntilExpiry < 7) {
          findings.push({
            type: 'error',
            message: `SSL certificate expires in ${sslInfo.daysUntilExpiry} days`,
            location: `SSL:${hostname}`,
          });
        } else if (sslInfo.daysUntilExpiry < 30) {
          findings.push({
            type: 'warning',
            message: `SSL certificate expires in ${sslInfo.daysUntilExpiry} days`,
            location: `SSL:${hostname}`,
          });
        } else {
          findings.push({
            type: 'info',
            message: `SSL certificate valid (${sslInfo.daysUntilExpiry} days until expiry)`,
            location: `SSL:${hostname}`,
          });
        }

        if (sslInfo.grade) {
          const gradeScore: Record<string, number> = { A: 100, B: 80, C: 60, D: 40, E: 20, F: 0 };
          const score = gradeScore[sslInfo.grade] || 50;
          if (score < 80) {
            findings.push({
              type: 'warning',
              message: `SSL grade: ${sslInfo.grade}`,
              location: `SSL:${hostname}`,
            });
          }
        }
      } else {
        findings.push({
          type: 'error',
          message: 'Could not retrieve SSL certificate info',
          location: `SSL:${hostname}`,
        });
      }

      return { findings, metadata: sslInfo as unknown as Record<string, unknown> };
    } catch (error) {
      findings.push({
        type: 'error',
        message: `SSL check failed: ${error}`,
        location: `SSL:${hostname}`,
      });
      return { findings };
    }
  }

  private async getSslInfo(hostname: string): Promise<SslInfo> {
    return new Promise((resolve) => {
      const options = {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
      };

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate();
        const result: SslInfo = { valid: false };

        if (cert && cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          result.valid = true;
          result.daysUntilExpiry = daysUntilExpiry;
          result.grade = 'A';
        }
        socket.end();
        resolve(result);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ valid: false });
      });

      socket.setTimeout(5000, () => {
        socket.destroy();
        resolve({ valid: false });
      });
    });
  }

  private async checkResponseTime(baseUrl: string): Promise<{ findings: Finding[]; metadata?: Record<string, unknown> }> {
    const findings: Finding[] = [];
    const times: number[] = [];

    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      try {
        await axios.head(baseUrl, { timeout: 10000 });
        times.push(Date.now() - start);
      } catch {
        times.push(9999);
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);

    if (avgTime > 3000) {
      findings.push({
        type: 'error',
        message: `Slow response time: ${Math.round(avgTime)}ms average`,
        location: baseUrl,
      });
    } else if (avgTime > 1500) {
      findings.push({
        type: 'warning',
        message: `Response time could be improved: ${Math.round(avgTime)}ms average`,
        location: baseUrl,
      });
    } else {
      findings.push({
        type: 'info',
        message: `Response time: ${Math.round(avgTime)}ms average`,
        location: baseUrl,
      });
    }

    return {
      findings,
      metadata: {
        avgResponseTime: Math.round(avgTime),
        minResponseTime: Math.round(minTime),
        maxResponseTime: Math.round(Math.max(...times)),
      },
    };
  }
}
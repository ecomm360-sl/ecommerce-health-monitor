import type { Store, CheckResult, NotificationPayload } from '../types';
import { db } from '../services/database';
import { createTelegramNotifier } from '../services/notifier';
import { SeoAgent } from './seo-agent';
import { WpoAgent } from './wpo-agent';
import { UptimeAgent } from './uptime-agent';
import { PrestaShopAdapter } from '../adapters/prestashop-adapter';
import type { Tenant } from '../types';

export type AgentType = 'seo' | 'wpo' | 'uptime';

export class Orchestrator {
  private tenant: Tenant;
  private store: Store;
  private notifier: ReturnType<typeof createTelegramNotifier> | null = null;

  constructor(tenant: Tenant, store: Store) {
    this.tenant = tenant;
    this.store = store;

    if (tenant.telegramBotToken && tenant.telegramChatId) {
      this.notifier = createTelegramNotifier(tenant.telegramBotToken, tenant.telegramChatId);
    }
  }

  private getPlatformConfig() {
    return {
      baseUrl: this.store.platform === 'prestashop' 
        ? `https://${this.store.domain}/api/`
        : `https://${this.store.domain}/api/`,
      apiKey: this.store.apiKey || '',
      apiSecret: this.store.apiSecret,
    };
  }

  private async runAgent(agentType: AgentType): Promise<CheckResult> {
    const config = this.getPlatformConfig();

    switch (agentType) {
      case 'seo':
        if (this.store.platform === 'prestashop') {
          const adapter = new PrestaShopAdapter(config);
          const agent = new SeoAgent(config);
          return agent.run();
        }
        return new SeoAgent(config).run();
      case 'wpo':
        return new WpoAgent(config).run();
      case 'uptime':
        return new UptimeAgent(config).run();
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  async runAllAgents(): Promise<CheckResult[]> {
    const agents: AgentType[] = ['uptime', 'wpo', 'seo'];
    const results: CheckResult[] = [];

    for (const agentType of agents) {
      try {
        console.log(`Running ${agentType} agent for ${this.store.name}...`);
        const result = await this.runAgent(agentType);
        results.push(result);

        await db.saveHealthCheck(this.store.id, result);

        if (this.shouldAlert(result)) {
          const payload: NotificationPayload = {
            tenantId: this.tenant.id,
            storeId: this.store.id,
            agent: result.agent as 'seo' | 'wpo' | 'uptime',
            severity: this.getSeverity(result),
            message: this.formatResultMessage(result),
            findings: result.findings,
          };

          await this.sendAlert(payload);
        }

        console.log(`${agentType} agent completed. Status: ${result.status}, Score: ${result.score}`);
      } catch (error) {
        console.error(`Error running ${agentType} agent:`, error);
        results.push({
          agent: agentType,
          status: 'critical',
          score: 0,
          findings: [{ type: 'error', message: `Agent execution failed: ${error}` }],
        });
      }
    }

    return results;
  }

  async runAgentByType(agentType: AgentType): Promise<CheckResult> {
    const result = await this.runAgent(agentType);
    await db.saveHealthCheck(this.store.id, result);

    if (this.shouldAlert(result)) {
      const payload: NotificationPayload = {
        tenantId: this.tenant.id,
        storeId: this.store.id,
        agent: result.agent as 'seo' | 'wpo' | 'uptime',
        severity: this.getSeverity(result),
        message: this.formatResultMessage(result),
        findings: result.findings,
      };

      await this.sendAlert(payload);
    }

    return result;
  }

  private shouldAlert(result: CheckResult): boolean {
    if (result.status === 'critical') return true;
    if (result.status === 'warning' && result.score < 60) return true;
    return false;
  }

  private getSeverity(result: CheckResult): 'critical' | 'warning' | 'info' {
    if (result.status === 'critical') return 'critical';
    if (result.status === 'warning') return 'warning';
    return 'info';
  }

  private formatResultMessage(result: CheckResult): string {
    const emoji = {
      critical: '❌',
      warning: '⚠️',
      ok: '✅',
    };

    let msg = `${emoji[result.status]} <b>${result.agent.toUpperCase()}</b>\n`;
    msg += `Score: <b>${result.score}/100</b>\n`;
    msg += `Status: ${result.status.toUpperCase()}\n\n`;

    const topFindings = result.findings.slice(0, 3);
    if (topFindings.length > 0) {
      msg += `<b>Top issues:</b>\n`;
      topFindings.forEach((f) => {
        msg += `• ${f.message}\n`;
      });
    }

    return msg;
  }

  private async sendAlert(payload: NotificationPayload): Promise<void> {
    if (!this.notifier) {
      console.log('Telegram notifier not configured, skipping alert');
      return;
    }

    try {
      await this.notifier.sendAlert(payload);
      await db.createAlert(payload, 'telegram');
      console.log('Alert sent via Telegram');
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (this.store.platform === 'prestashop') {
      const adapter = new PrestaShopAdapter(this.getPlatformConfig());
      return adapter.testConnection();
    }
    return false;
  }
}

export async function runStoreChecks(storeId: number): Promise<CheckResult[]> {
  const store = await db.getStoreById(storeId);
  if (!store) {
    throw new Error(`Store not found: ${storeId}`);
  }

  const tenant = await db.getTenantById(store.tenantId);
  if (!tenant) {
    throw new Error(`Tenant not found: ${store.tenantId}`);
  }

  const orchestrator = new Orchestrator(tenant, store);
  return orchestrator.runAllAgents();
}

export async function runAgentCheck(storeId: number, agentType: AgentType): Promise<CheckResult> {
  const store = await db.getStoreById(storeId);
  if (!store) {
    throw new Error(`Store not found: ${storeId}`);
  }

  const tenant = await db.getTenantById(store.tenantId);
  if (!tenant) {
    throw new Error(`Tenant not found: ${store.tenantId}`);
  }

  const orchestrator = new Orchestrator(tenant, store);
  return orchestrator.runAgentByType(agentType);
}
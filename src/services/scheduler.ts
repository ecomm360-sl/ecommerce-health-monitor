import cron from 'node-cron';
import { db } from './database';
import { runStoreChecks } from '../agents/orchestrator';
import { createTelegramNotifier } from './notifier';

const schedules = {
  uptime: process.env.UPTIME_CRON || '*/30 * * * *',
  wpo: process.env.WPO_CRON || '0 */2 * * *',
  seo: process.env.SEO_CRON || '0 */4 * * *',
};

const runningJobs: Map<string, cron.ScheduledTask> = new Map();

export async function startScheduler(): Promise<void> {
  console.log('Starting health monitor scheduler...');

  const uptimeTask = cron.schedule(schedules.uptime, async () => {
    console.log('Running uptime checks...');
    await runAllUptimeChecks();
  }, {
    scheduled: true,
    timezone: 'Europe/Madrid',
  });
  runningJobs.set('uptime', uptimeTask);

  const wpoTask = cron.schedule(schedules.wpo, async () => {
    console.log('Running WPO checks...');
    await runAllWpoChecks();
  }, {
    scheduled: true,
    timezone: 'Europe/Madrid',
  });
  runningJobs.set('wpo', wpoTask);

  const seoTask = cron.schedule(schedules.seo, async () => {
    console.log('Running SEO checks...');
    await runAllSeoChecks();
  }, {
    scheduled: true,
    timezone: 'Europe/Madrid',
  });
  runningJobs.set('seo', seoTask);

  console.log('Scheduler started with schedules:');
  console.log(`  Uptime: ${schedules.uptime}`);
  console.log(`  WPO: ${schedules.wpo}`);
  console.log(`  SEO: ${schedules.seo}`);
}

export async function stopScheduler(): Promise<void> {
  console.log('Stopping scheduler...');
  for (const [name, task] of runningJobs) {
    task.stop();
    console.log(`Stopped ${name} job`);
  }
  runningJobs.clear();
}

async function runAllUptimeChecks(): Promise<void> {
  try {
    const tenants = await db.getActiveTenants();

    for (const tenant of tenants) {
      const stores = await db.getStoresByTenant(tenant.id);

      for (const store of stores) {
        if (!store.active) continue;

        try {
          console.log(`Uptime check: ${store.name} (${store.domain})`);
          const { UptimeAgent } = await import('../agents/uptime-agent');
          const config = {
            baseUrl: `https://${store.domain}/api/`,
            apiKey: store.apiKey || '',
          };
          const agent = new UptimeAgent(config);
          const result = await agent.run();

          await db.saveHealthCheck(store.id, result);

          if (result.status === 'critical' && tenant.telegramBotToken && tenant.telegramChatId) {
            const notifier = createTelegramNotifier(tenant.telegramBotToken, tenant.telegramChatId);
            await notifier.sendAlert({
              tenantId: tenant.id,
              storeId: store.id,
              agent: 'uptime',
              severity: 'critical',
              message: `❌ <b>UPTIME CRITICAL</b>\n\n🏪 ${store.name}\n\n${result.findings[0]?.message || 'Site is down!'}`,
              findings: result.findings,
            });
          }
        } catch (error) {
          console.error(`Error checking store ${store.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in uptime check cron:', error);
  }
}

async function runAllWpoChecks(): Promise<void> {
  try {
    const tenants = await db.getActiveTenants();

    for (const tenant of tenants) {
      const stores = await db.getStoresByTenant(tenant.id);

      for (const store of stores) {
        if (!store.active) continue;

        try {
          console.log(`WPO check: ${store.name} (${store.domain})`);
          const { WpoAgent } = await import('../agents/wpo-agent');
          const config = {
            baseUrl: `https://${store.domain}/api/`,
            apiKey: store.apiKey || '',
          };
          const agent = new WpoAgent(config);
          const result = await agent.run();

          await db.saveHealthCheck(store.id, result);

          if (result.status === 'critical' && tenant.telegramBotToken && tenant.telegramChatId) {
            const notifier = createTelegramNotifier(tenant.telegramBotToken, tenant.telegramChatId);
            await notifier.sendAlert({
              tenantId: tenant.id,
              storeId: store.id,
              agent: 'wpo',
              severity: 'critical',
              message: `⚡ <b>PERFORMANCE CRITICAL</b>\n\n🏪 ${store.name}\n\nScore: ${result.score}/100`,
              findings: result.findings,
            });
          }
        } catch (error) {
          console.error(`Error checking store ${store.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in WPO check cron:', error);
  }
}

async function runAllSeoChecks(): Promise<void> {
  try {
    const tenants = await db.getActiveTenants();

    for (const tenant of tenants) {
      const stores = await db.getStoresByTenant(tenant.id);

      for (const store of stores) {
        if (!store.active) continue;

        try {
          console.log(`SEO check: ${store.name} (${store.domain})`);
          const { SeoAgent } = await import('../agents/seo-agent');
          const config = {
            baseUrl: `https://${store.domain}/api/`,
            apiKey: store.apiKey || '',
          };
          const agent = new SeoAgent(config);
          const result = await agent.run();

          await db.saveHealthCheck(store.id, result);

          if (result.status === 'critical' && tenant.telegramBotToken && tenant.telegramChatId) {
            const notifier = createTelegramNotifier(tenant.telegramBotToken, tenant.telegramChatId);
            await notifier.sendAlert({
              tenantId: tenant.id,
              storeId: store.id,
              agent: 'seo',
              severity: 'critical',
              message: `🔍 <b>SEO CRITICAL</b>\n\n🏪 ${store.name}\n\nScore: ${result.score}/100\n\n${result.findings[0]?.message || ''}`,
              findings: result.findings,
            });
          }
        } catch (error) {
          console.error(`Error checking store ${store.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in SEO check cron:', error);
  }
}

export function getScheduleInfo() {
  return {
    schedules,
    running: Array.from(runningJobs.keys()),
  };
}
import { PrismaClient } from '@prisma/client';
import { db } from './services/database';
import { runStoreChecks, runAgentCheck, type AgentType } from './agents/orchestrator';
import { startScheduler, stopScheduler, getScheduleInfo } from './services/scheduler';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await seedDatabase();
      break;

    case 'check':
      await runCheck(args[1]);
      break;

    case 'check:agent':
      await runCheckAgent(args[1], args[2] as AgentType);
      break;

    case 'schedule':
      await startScheduler();
      console.log('Scheduler started. Press Ctrl+C to stop.');
      process.on('SIGINT', async () => {
        await stopScheduler();
        process.exit(0);
      });
      break;

    case 'schedule:stop':
      await stopScheduler();
      console.log('Scheduler stopped.');
      break;

    case 'schedule:info':
      console.log(getScheduleInfo());
      break;

    case 'stores':
      await listStores();
      break;

    case 'checks':
      await showChecks(args[1]);
      break;

    case 'help':
    default:
      showHelp();
  }
}

async function seedDatabase() {
  console.log('Seeding database...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      slug: 'default',
      name: 'Default Tenant',
      email: 'admin@example.com',
      plan: 'pro',
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '8389484342:AAFeSpgmVIlhbVO6Iru2JHxMiJAbhOopQjw',
      telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
      active: 1,
    },
  });

  console.log(`Created tenant: ${tenant.name}`);

  const store = await prisma.store.upsert({
    where: { id: 1 },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Alabazweb',
      platform: 'prestashop',
      domain: 'alabazweb.com',
      url: 'https://alabazweb.com',
      apiKey: 'J5IXUJ319WN5N4E59D9N3TF57AJWF77H',
      active: 1,
    },
  });

  console.log(`Created store: ${store.name} (${store.domain})`);
  console.log('Database seeded successfully!');
}

async function runCheck(storeId?: string) {
  if (!storeId) {
    console.log('Running all checks for all stores...');
    const stores = await prisma.store.findMany({ where: { active: 1 } });
    for (const store of stores) {
      console.log(`\n=== Checking ${store.name} ===`);
      await runStoreChecks(store.id);
    }
  } else {
    console.log(`Running all checks for store ${storeId}...`);
    await runStoreChecks(parseInt(storeId));
  }
}

async function runCheckAgent(storeId?: string, agent?: AgentType) {
  if (!storeId || !agent) {
    console.log('Usage: npm run check:agent <storeId> <agent>');
    console.log('Agents: seo, wpo, uptime');
    return;
  }

  console.log(`Running ${agent} check for store ${storeId}...`);
  const result = await runAgentCheck(parseInt(storeId), agent);
  console.log('\nResult:');
  console.log(JSON.stringify(result, null, 2));
}

async function listStores() {
  const stores = await prisma.store.findMany({
    include: { tenant: true },
  });

  console.log('\nStores:');
  for (const store of stores) {
    console.log(`  [${store.id}] ${store.name} (${store.platform}) - ${store.domain}`);
    console.log(`       Tenant: ${store.tenant.name}`);
    console.log(`       Active: ${store.active === 1 ? 'Yes' : 'No'}`);
    console.log();
  }
}

async function showChecks(storeId?: string) {
  if (!storeId) {
    console.log('Usage: npm run checks <storeId>');
    return;
  }

  const checks = await db.getLatestChecksByAgent(parseInt(storeId));

  console.log(`\nLatest checks for store ${storeId}:`);
  for (const check of checks) {
    console.log(`\n[${check.agent}]`);
    console.log(`  Status: ${check.status}`);
    console.log(`  Score: ${check.score}/100`);
    console.log(`  Checked: ${check.checkedAt}`);
    if (check.findings) {
      const findings = typeof check.findings === 'string' ? JSON.parse(check.findings) : check.findings;
      console.log(`  Findings: ${findings.length}`);
    }
  }
}

function showHelp() {
  console.log(`
Ecommerce Health Monitor CLI

Commands:
  npm run check           Run all checks for all stores
  npm run check <storeId>  Run all checks for a specific store
  npm run check:agent <storeId> <agent>  Run specific agent check
                          Agents: seo, wpo, uptime
  npm run schedule         Start the scheduler (cron jobs)
  npm run schedule:stop    Stop the scheduler
  npm run schedule:info    Show schedule info
  npm run stores          List all stores
  npm run checks <storeId> Show latest checks for a store
  npm run init             Seed the database with initial data

Environment Variables:
  TELEGRAM_BOT_TOKEN      Telegram bot token
  TELEGRAM_CHAT_ID        Telegram chat ID
  DATABASE_URL            SQLite database path
  `);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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

  console.log(`Created tenant: ${tenant.name} (ID: ${tenant.id})`);

  const existingStore = await prisma.store.findFirst({
    where: { domain: 'alabazweb.com' },
  });

  if (!existingStore) {
    const store = await prisma.store.create({
      data: {
        tenantId: tenant.id,
        name: 'Alabazweb',
        platform: 'prestashop',
        domain: 'alabazweb.com',
        url: 'https://alabazweb.com',
        apiKey: 'J5IXUJ319WN5N4E59D9N3TF57AJWF77H',
        active: 1,
      },
    });
    console.log(`Created store: ${store.name} (ID: ${store.id})`);
    console.log(`  Domain: ${store.domain}`);
    console.log(`  Platform: ${store.platform}`);
    console.log(`  API Key: ${store.apiKey}`);
  } else {
    console.log(`Store already exists: ${existingStore.name}`);
  }

  console.log('\nDatabase seeded successfully!');
}

main()
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
# Ecommerce Health Monitor

Multi-tenant health monitoring system for ecommerce platforms (Shopify, PrestaShop, WooCommerce, WordPress, Logicommerce).

## Features

- **SEO Agent**: Sitemap, robots.txt, meta tags, schema.org, canonical tags, alt texts
- **WPO Agent**: PageSpeed, Core Web Vitals (LCP, INP, CLS), TTFB, image optimization
- **Uptime Agent**: HTTP status, response time, SSL certificate validity
- **Multi-tenant**: Manage multiple clients/stores from a single dashboard
- **Telegram Alerts**: Real-time notifications for critical issues
- **Scheduler**: Configurable cron jobs for automated checks

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Seed initial data
npx tsx scripts/seed.ts

# Run development server
npm run dev

# Or run checks manually
npm run check 1
```

## Docker / EasyPanel

```bash
# Build and run
docker-compose up -d

# Or with custom Telegram token
TELEGRAM_BOT_TOKEN=your_token docker-compose up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | - |
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `UPTIME_CRON` | Uptime check schedule | `*/30 * * * *` |
| `WPO_CRON` | WPO check schedule | `0 */2 * * *` |
| `SEO_CRON` | SEO check schedule | `0 */4 * * *` |

## API Endpoints

- `POST /api/checks` - Run checks for a store
- `GET /api/checks?storeId=1` - Get checks history
- `GET /api/stores` - List all stores
- `POST /api/stores` - Create new store

## Architecture

```
ecommerce-health-monitor/
├── src/
│   ├── agents/           # SEO, WPO, Uptime agents
│   ├── adapters/         # Platform adapters (PrestaShop, etc.)
│   ├── services/         # Database, Notifier, Scheduler
│   └── cli.ts           # CLI commands
├── app/                  # Next.js dashboard
├── prisma/              # Database schema
└── scripts/             # Seed script
```

## Supported Platforms

- Shopify (via Admin API)
- PrestaShop (via Webservice API)
- WooCommerce (via REST API)
- WordPress (via REST API)
- Logicommerce (custom adapter)

## License

MIT
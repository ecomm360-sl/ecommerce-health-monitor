#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate

echo "Pushing database schema..."
npx prisma db push

echo "Seeding database..."
npx ts-node scripts/seed.ts

echo ""
echo "Setup complete!"
echo ""
echo "To run checks manually:"
echo "  npm run check           - Run all checks"
echo "  npm run check 1        - Run checks for store ID 1"
echo ""
echo "To start the dashboard:"
echo "  npm run dev"
echo ""
echo "To start the scheduler:"
echo "  npm run schedule"
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const stores = await prisma.store.findMany({
      where: { active: 1 },
      include: {
        checks: {
          orderBy: { checkedAt: 'desc' },
          take: 1,
        },
      },
    });

    return NextResponse.json(stores);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, domain, platform, apiKey, apiSecret } = body;

    if (!name || !domain || !platform) {
      return NextResponse.json({ error: 'name, domain and platform are required' }, { status: 400 });
    }

    const store = await prisma.store.create({
      data: {
        tenantId: 1,
        name,
        domain,
        platform,
        url: `https://${domain}`,
        apiKey: apiKey || null,
        apiSecret: apiSecret || null,
        active: 1,
      },
    });

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}
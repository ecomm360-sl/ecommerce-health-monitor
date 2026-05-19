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
    const { name, domain, platform, apiKey, apiSecret, tenantId } = body;

    const store = await prisma.store.create({
      data: {
        tenantId: tenantId || 1,
        name,
        domain,
        platform,
        url: `https://${domain}`,
        apiKey,
        apiSecret,
        active: 1,
      },
    });

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { runStoreChecks } from '../../../src/agents/orchestrator';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

    const results = await runStoreChecks(storeId);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Check execution error:', error);
    return NextResponse.json({ error: 'Failed to run checks' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

    const checks = await prisma.healthCheck.findMany({
      where: { storeId: parseInt(storeId) },
      orderBy: { checkedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(checks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch checks' }, { status: 500 });
  }
}
import { PrismaClient } from '@prisma/client';
import type { HealthCheck, Alert, Store, Tenant, CheckResult, AgentType, NotificationPayload } from '../types';

const prisma = new PrismaClient();

export class DatabaseService {
  async getStoreById(id: number): Promise<Store | null> {
    const store = await prisma.store.findUnique({ where: { id } });
    return store as Store | null;
  }

  async getStoreByDomain(domain: string): Promise<Store | null> {
    const store = await prisma.store.findFirst({ where: { domain } });
    return store as Store | null;
  }

  async getStoresByTenant(tenantId: number): Promise<Store[]> {
    const stores = await prisma.store.findMany({ where: { tenantId, active: 1 } });
    return stores as Store[];
  }

  async getActiveTenants(): Promise<Tenant[]> {
    const tenants = await prisma.tenant.findMany({ where: { active: 1 } });
    return tenants as Tenant[];
  }

  async getTenantById(id: number): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    return tenant as Tenant | null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    return tenant as Tenant | null;
  }

  async createStore(data: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): Promise<Store> {
    const store = await prisma.store.create({ data });
    return store as Store;
  }

  async createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const tenant = await prisma.tenant.create({ data });
    return tenant as Tenant;
  }

  async saveHealthCheck(storeId: number, result: CheckResult): Promise<HealthCheck> {
    const check = await prisma.healthCheck.create({
      data: {
        storeId,
        agent: result.agent,
        status: result.status,
        score: result.score,
        findings: JSON.stringify(result.findings),
      },
    });
    return check as HealthCheck;
  }

  async getHealthChecks(storeId: number, limit = 100): Promise<HealthCheck[]> {
    const checks = await prisma.healthCheck.findMany({
      where: { storeId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    });
    return checks as HealthCheck[];
  }

  async getLatestChecksByAgent(storeId: number): Promise<HealthCheck[]> {
    const checks = await prisma.healthCheck.groupBy({
      by: ['agent'],
      where: { storeId },
      _max: { checkedAt: true },
    });

    const result: HealthCheck[] = [];
    for (const check of checks) {
      if (!check._max.checkedAt) continue;
      const latest = await prisma.healthCheck.findFirst({
        where: {
          storeId,
          agent: check.agent,
          checkedAt: check._max.checkedAt,
        },
      });
      if (latest) result.push(latest as HealthCheck);
    }

    return result;
  }

  async createAlert(payload: NotificationPayload, sentVia: string): Promise<Alert> {
    const alert = await prisma.alert.create({
      data: {
        tenantId: payload.tenantId,
        storeId: payload.storeId,
        agent: payload.agent,
        severity: payload.severity,
        message: payload.message,
        sentVia,
      },
    });
    return alert as Alert;
  }

  async getAlertsByTenant(tenantId: number, limit = 50): Promise<Alert[]> {
    const alerts = await prisma.alert.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { store: true },
    });
    return alerts as unknown as Alert[];
  }

  async getDashboardStats(storeId: number) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [checks24h, checks7d, byAgent] = await Promise.all([
      prisma.healthCheck.count({
        where: { storeId, checkedAt: { gte: last24h } },
      }),
      prisma.healthCheck.count({
        where: { storeId, checkedAt: { gte: last7d } },
      }),
      prisma.healthCheck.groupBy({
        by: ['agent', 'status'],
        where: { storeId, checkedAt: { gte: last7d } },
        _count: true,
      }),
    ]);

    return {
      checks24h,
      checks7d,
      byAgent,
    };
  }
}

export const db = new DatabaseService();
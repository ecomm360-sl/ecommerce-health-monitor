import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface StoreWithChecks {
  id: number;
  name: string;
  domain: string;
  platform: string;
  active: number;
  checks: {
    agent: string;
    status: string;
    score: number;
    checkedAt: Date;
  }[];
}

async function getStores(): Promise<StoreWithChecks[]> {
  const stores = await prisma.store.findMany({
    where: { active: 1 },
    include: {
      checks: {
        orderBy: { checkedAt: 'desc' },
        take: 3,
      },
    },
  });

  return stores as unknown as StoreWithChecks[];
}

export default async function HomePage() {
  const stores = await getStores();

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-800';
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600">Monitor the health of your ecommerce stores</p>
        </div>
        <div className="flex space-x-3">
          <a
            href="/stores"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            + Add Store
          </a>
          <form action="/api/checks/run" method="POST">
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Run All Checks
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-primary-600">{stores.length}</div>
          <div className="text-gray-600">Active Stores</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">
            {stores.filter((s) => s.checks.every((c) => c.status === 'ok')).length}
          </div>
          <div className="text-gray-600">Healthy Stores</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-red-600">
            {stores.filter((s) => s.checks.some((c) => c.status === 'critical')).length}
          </div>
          <div className="text-gray-600">Critical Issues</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Stores Overview</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {stores.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No stores configured yet. Add your first store to start monitoring.
            </div>
          ) : (
            stores.map((store) => (
              <div key={store.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-lg font-medium text-gray-900">{store.name}</h4>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(
                          store.checks[0]?.status || 'unknown'
                        )}`}
                      >
                        {store.checks[0]?.status || 'No data'}
                      </span>
                      <span className="text-sm text-gray-500">{store.platform}</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">{store.domain}</div>
                  </div>
                  <div className="flex items-center space-x-6">
                    {['uptime', 'wpo', 'seo'].map((agent) => {
                      const check = store.checks.find((c) => c.agent === agent);
                      return (
                        <div key={agent} className="text-center">
                          <div className="text-xs text-gray-500 uppercase">{agent}</div>
                          <div
                            className={`mt-1 px-2 py-1 rounded text-sm font-medium ${getScoreColor(
                              check?.score ?? null
                            )}`}
                          >
                            {check?.score ?? '-'}
                          </div>
                        </div>
                      );
                    })}
                    <a
                      href={`/stores/${store.id}`}
                      className="px-3 py-1 text-sm text-primary-600 hover:text-primary-800"
                    >
                      Details →
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
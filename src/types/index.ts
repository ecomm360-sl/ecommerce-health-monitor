export interface Tenant {
  id: number;
  slug: string;
  name: string;
  email: string;
  plan: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  emailAlerts?: string;
  active: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  id: number;
  tenantId: number;
  name: string;
  platform: 'shopify' | 'prestashop' | 'woocommerce' | 'wordpress' | 'logicommerce';
  domain: string;
  url: string;
  apiKey?: string;
  apiSecret?: string;
  config?: string;
  active: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthCheck {
  id: number;
  storeId: number;
  agent: AgentType;
  status: 'ok' | 'warning' | 'critical';
  score?: number;
  findings?: string | Finding[];
  checkedAt: Date;
}

export interface Finding {
  type: 'error' | 'warning' | 'info';
  message: string;
  location?: string;
  suggestion?: string;
}

export type AgentType = 'seo' | 'wpo' | 'uptime' | 'js_errors' | 'geo' | 'security';

export interface CheckResult {
  agent: AgentType;
  status: 'ok' | 'warning' | 'critical';
  score: number;
  findings: Finding[];
  metadata?: Record<string, unknown>;
}

export interface NotificationPayload {
  tenantId: number;
  storeId: number;
  agent: AgentType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  findings?: Finding[];
}

export interface Alert {
  id: number;
  tenantId: number;
  storeId: number;
  agent: AgentType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  sentVia: string;
  createdAt: Date;
}

export interface PlatformConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret?: string;
  webServiceUrl?: string;
}
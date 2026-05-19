import axios from 'axios';
import type { NotificationPayload } from '../types';

export class TelegramNotifier {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  async sendMessage(text: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      return true;
    } catch (error) {
      console.error('Telegram send error:', error);
      return false;
    }
  }

  formatAlert(payload: NotificationPayload): string {
    const emoji = {
      critical: '🔴',
      warning: '🟡',
      info: '🔵',
    };

    const agentEmoji = {
      seo: '🔍',
      wpo: '⚡',
      uptime: '📈',
      js_errors: '💻',
      geo: '📍',
      security: '🔒',
    };

    let message = `${emoji[payload.severity]} <b>${payload.agent.toUpperCase()} Alert</b>\n`;
    message += `${agentEmoji[payload.agent]} Store: <code>${payload.storeId}</code>\n\n`;
    message += `${payload.message}\n\n`;

    if (payload.findings && payload.findings.length > 0) {
      message += `<b>Findings:</b>\n`;
      payload.findings.slice(0, 5).forEach((finding) => {
        const findingEmoji = finding.type === 'error' ? '❌' : finding.type === 'warning' ? '⚠️' : 'ℹ️';
        message += `${findingEmoji} ${finding.message}\n`;
      });
      if (payload.findings.length > 5) {
        message += `\n<i>...and ${payload.findings.length - 5} more</i>`;
      }
    }

    return message;
  }

  async sendAlert(payload: NotificationPayload): Promise<boolean> {
    const message = this.formatAlert(payload);
    return this.sendMessage(message);
  }

  async sendDailyReport(storeName: string, results: { agent: string; status: string; score: number }[]): Promise<boolean> {
    let message = `📊 <b>Daily Report</b>\n`;
    message += `🏪 ${storeName}\n`;
    message += `📅 ${new Date().toLocaleDateString()}\n\n`;

    for (const result of results) {
      const emoji = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      message += `${emoji} <b>${result.agent.toUpperCase()}</b>: ${result.score}/100\n`;
    }

    return this.sendMessage(message);
  }
}

export function createTelegramNotifier(botToken: string, chatId: string): TelegramNotifier {
  return new TelegramNotifier(botToken, chatId);
}
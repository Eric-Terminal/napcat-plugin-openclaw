// 配置管理器

interface OpenClawConfig {
  host: string;
  port: number;
  token: string;
  user: string;
}

interface TriggersConfig {
  keywords: string[];
  atTrigger: boolean;
}

interface WhitelistConfig {
  users: number[];
  groups: number[];
}

interface LimitsConfig {
  ratePerUserPerHour: number;
  maxConcurrent: number;
  taskTimeoutSec: number;
  cooldownSec: number;
}

interface FilterConfig {
  enabled: boolean;
}

export class ConfigManager {
  private config: any = {};

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    // 从环境变量或默认配置加载
    // NapCat 会在初始化后通过 plugin_config_ui 提供配置
    this.config = {
      openclaw: {
        host: '202.47.135.226',
        port: 18789,
        token: '',
        user: 'root'
      },
      triggers: {
        keywords: ['莲莲帮我'],
        atTrigger: false
      },
      whitelist: {
        users: [],
        groups: []
      },
      limits: {
        ratePerUserPerHour: 5,
        maxConcurrent: 3,
        taskTimeoutSec: 180,
        cooldownSec: 3
      },
      filter: {
        enabled: true
      }
    };
  }

  updateConfig(newConfig: any): void {
    this.config = { ...this.config, ...newConfig };
  }

  getOpenClawConfig(): OpenClawConfig {
    return {
      host: this.config.openclaw?.host || '202.47.135.226',
      port: this.config.openclaw?.port || 18789,
      token: this.config.openclaw?.token || '',
      user: this.config.openclaw?.user || 'root'
    };
  }

  getTriggers(): TriggersConfig & { botUserId?: number } {
    return {
      keywords: this.config.triggers?.keywords || ['莲莲帮我'],
      atTrigger: this.config.triggers?.atTrigger || false,
      botUserId: this.config.botUserId
    };
  }

  getWhitelist(): WhitelistConfig {
    return {
      users: this.config.whitelist?.users || [],
      groups: this.config.whitelist?.groups || []
    };
  }

  getLimits(): LimitsConfig {
    return {
      ratePerUserPerHour: this.config.limits?.ratePerUserPerHour || 5,
      maxConcurrent: this.config.limits?.maxConcurrent || 3,
      taskTimeoutSec: this.config.limits?.taskTimeoutSec || 180,
      cooldownSec: this.config.limits?.cooldownSec || 3
    };
  }

  getCooldown(): number {
    return this.config.limits?.cooldownSec || 3;
  }

  getTaskTimeout(): number {
    return this.config.limits?.taskTimeoutSec || 180;
  }

  isFilterEnabled(): boolean {
    return this.config.filter?.enabled !== false;
  }

  isGroupAllowed(groupId: number): boolean {
    const groups = this.getWhitelist().groups;
    if (groups.length === 0) return true;
    return groups.includes(groupId);
  }

  isUserAllowed(userId: number): boolean {
    const users = this.getWhitelist().users;
    if (users.length === 0) return true;
    return users.includes(userId);
  }

  setBotUserId(botUserId: number): void {
    this.config.botUserId = botUserId;
  }
}

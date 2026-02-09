import type { PluginConfig } from './types';

export const DEFAULT_CONFIG: PluginConfig = {
  openclaw: {
    token: '',
    gatewayUrl: 'ws://127.0.0.1:18789',
    cliPath: '/root/.nvm/versions/node/v22.22.0/bin/openclaw',
  },
  behavior: {
    privateChat: true,
    groupAtOnly: true,
    userWhitelist: [],
    groupWhitelist: [],
  },
};

export function buildConfigSchema() {
  return [
    {
      key: 'openclaw.token',
      label: 'OpenClaw Token',
      type: 'string',
      default: '',
      description: 'OpenClaw Gateway 认证 Token',
    },
    {
      key: 'openclaw.gatewayUrl',
      label: 'Gateway URL',
      type: 'string',
      default: 'ws://127.0.0.1:18789',
      description: 'OpenClaw Gateway WebSocket 地址',
    },
    {
      key: 'openclaw.cliPath',
      label: 'CLI Path',
      type: 'string',
      default: '/root/.nvm/versions/node/v22.22.0/bin/openclaw',
      description: 'openclaw CLI 路径（回退模式使用）',
    },
    {
      key: 'behavior.privateChat',
      label: '私聊模式',
      type: 'boolean',
      default: true,
      description: '是否接收私聊消息',
    },
    {
      key: 'behavior.groupAtOnly',
      label: '群聊@触发',
      type: 'boolean',
      default: true,
      description: '群聊中仅 @bot 时触发',
    },
    {
      key: 'behavior.userWhitelist',
      label: '用户白名单',
      type: 'string',
      default: '',
      description: '允许使用的 QQ 号，逗号分隔（留空允许所有）',
    },
    {
      key: 'behavior.groupWhitelist',
      label: '群白名单',
      type: 'string',
      default: '',
      description: '允许的群号，逗号分隔（留空允许所有）',
    },
  ];
}

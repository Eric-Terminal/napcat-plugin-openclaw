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
    debounceMs: 2000,
    groupSessionMode: 'user',
  },
};

export function buildConfigSchema(): any[] {
  return [
    {
      key: 'token',
      label: 'OpenClaw Token',
      type: 'string',
      default: '',
      placeholder: '填入 OpenClaw Gateway Token',
      description: '用于连接 OpenClaw Gateway 的认证令牌',
    },
    {
      key: 'gatewayUrl',
      label: 'Gateway WebSocket 地址',
      type: 'string',
      default: 'ws://127.0.0.1:18789',
      placeholder: 'ws://host:port',
      description: 'OpenClaw Gateway 的 WebSocket 连接地址',
    },
    {
      key: 'cliPath',
      label: 'CLI 路径（备用）',
      type: 'string',
      default: '/root/.nvm/versions/node/v22.22.0/bin/openclaw',
      description: 'WebSocket 不可用时降级使用的 openclaw CLI 路径',
    },
    {
      key: 'privateChat',
      label: '启用私聊',
      type: 'boolean',
      default: true,
      description: '是否响应私聊消息',
    },
    {
      key: 'groupAtOnly',
      label: '群聊仅@触发',
      type: 'boolean',
      default: true,
      description: '群聊中是否仅在被@时响应',
    },
    {
      key: 'userWhitelist',
      label: '用户白名单',
      type: 'string',
      default: '',
      placeholder: '多个 QQ 号用英文逗号分隔，留空不限制',
      description: '允许使用的 QQ 号列表（逗号分隔），留空表示所有人',
    },
    {
      key: 'groupWhitelist',
      label: '群白名单',
      type: 'string',
      default: '',
      placeholder: '多个群号用英文逗号分隔，留空不限制',
      description: '允许使用的群号列表（逗号分隔），留空表示所有群',
    },
    {
      key: 'debounceMs',
      label: '防抖间隔 (ms)',
      type: 'number',
      default: 2000,
      description: '同一用户连续消息的合并等待时间',
    },
    {
      key: 'groupSessionMode',
      label: '群会话模式',
      type: 'select',
      default: 'user',
      options: [
        { label: '每人独立会话', value: 'user' },
        { label: '群共享会话', value: 'shared' },
      ],
      description: '群聊中是否每个成员独立会话',
    },
  ];
}

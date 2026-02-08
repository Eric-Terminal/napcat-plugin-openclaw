// NapCat Plugin Entry Point
// 遵循 NapCat 插件规范: https://napneko.github.io/develop/plugin/

import { OpenClawClient } from './openclaw-client.js';
import { TaskManager } from './task-manager.js';
import { ConfigManager } from './config-manager.js';
import { FileFetcher } from './file-fetcher.js';

interface PluginContext {
  actions: {
    call: (action: string, params: any) => Promise<any>;
  };
  log: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  };
}

interface MessageEvent {
  post_type: string;
  message_type?: string;
  group_id?: number;
  user_id: number;
  message_id: number;
  message: Array<{ type: string; data: any }>;
  sender?: {
    nickname?: string;
  };
}

let ctx: PluginContext | null = null;
let configManager: ConfigManager | null = null;
let taskManager: TaskManager | null = null;
let openClawClient: OpenClawClient | null = null;
let fileFetcher: FileFetcher | null = null;
let lastSendTime = 0;

// ========== NapCat 生命周期钩子 ==========

export async function plugin_init(context: PluginContext): Promise<void> {
  ctx = context;
  ctx.log.info('[OpenClaw] Plugin initializing...');

  // 初始化配置管理器
  configManager = new ConfigManager();
  
  // 初始化任务管理器
  taskManager = new TaskManager(configManager.getLimits());
  
  // 初始化 OpenClaw 客户端
  const openClawConfig = configManager.getOpenClawConfig();
  openClawClient = new OpenClawClient(
    openClawConfig.host,
    openClawConfig.port,
    openClawConfig.token,
    (msg) => ctx?.log.info(msg),
    (msg) => ctx?.log.error(msg)
  );

  // 初始化文件获取器
  fileFetcher = new FileFetcher(openClawConfig.host, openClawConfig.user || 'root');

  ctx.log.info('[OpenClaw] Plugin initialized successfully');
}

export async function plugin_onmessage(event: MessageEvent): Promise<void> {
  if (!ctx || !configManager || !taskManager || !openClawClient || !fileFetcher) {
    return;
  }

  // 只处理群消息
  if (event.post_type !== 'message' || event.message_type !== 'group') {
    return;
  }

  const groupId = event.group_id;
  const userId = event.user_id;
  const messageId = event.message_id;
  const nickname = event.sender?.nickname || '未知';

  if (!groupId) return;

  // 检查白名单
  if (!configManager.isGroupAllowed(groupId)) return;
  if (!configManager.isUserAllowed(userId)) return;

  // 提取文本
  const text = extractText(event.message);
  if (!text) return;

  // 检查是否有等待输入的任务
  const waitingTask = taskManager.getWaitingTask(groupId, userId);
  if (waitingTask) {
    await continueTask(waitingTask, text, groupId, messageId);
    return;
  }

  // 检查触发词
  const triggerResult = checkTrigger(text, event.message, configManager.getTriggers());
  if (!triggerResult.triggered) return;

  ctx.log.info(`[OpenClaw] Triggered by ${nickname}(${userId}): ${triggerResult.taskText.slice(0, 50)}`);

  // 创建任务
  const sessionKey = `qq-${groupId}-${userId}`;
  const createResult = taskManager.createTask(groupId, userId, nickname, triggerResult.taskText, messageId, sessionKey);
  
  if (!createResult.ok) {
    await sendReply(groupId, messageId, createResult.error || '创建任务失败');
    return;
  }

  const task = createResult.task!;

  // 意图过滤
  if (configManager.isFilterEnabled()) {
    const filterResult = await openClawClient.filterTask(triggerResult.taskText, nickname);
    if (!filterResult.accept) {
      taskManager.failTask(task.taskId, 'filtered');
      await sendReply(groupId, messageId, filterResult.reason || '这个请求我帮不了呢~');
      return;
    }
  }

  // 执行任务
  await runTask(task, groupId, messageId);
}

export async function plugin_cleanup(): Promise<void> {
  ctx?.log.info('[OpenClaw] Plugin cleaning up...');
  openClawClient?.close();
  ctx?.log.info('[OpenClaw] Plugin cleaned up');
}

// ========== WebUI 配置 ==========

export const plugin_config_ui = {
  openclaw: {
    type: 'object',
    description: 'OpenClaw 连接配置',
    properties: {
      host: { type: 'string', default: '202.47.135.226', description: 'OpenClaw 主机地址' },
      port: { type: 'number', default: 18789, description: 'OpenClaw 端口' },
      token: { type: 'string', default: '', description: 'OpenClaw 认证 Token' },
      user: { type: 'string', default: 'root', description: 'SSH 用户名（用于 SCP 文件传输）' }
    }
  },
  triggers: {
    type: 'object',
    description: '触发词配置',
    properties: {
      keywords: { 
        type: 'array', 
        items: { type: 'string' },
        default: ['莲莲帮我'],
        description: '触发关键词列表'
      },
      atTrigger: { type: 'boolean', default: false, description: '是否支持 @ 触发' }
    }
  },
  whitelist: {
    type: 'object',
    description: '白名单配置（空数组表示允许所有）',
    properties: {
      users: { type: 'array', items: { type: 'number' }, default: [], description: '允许的用户 QQ 号' },
      groups: { type: 'array', items: { type: 'number' }, default: [], description: '允许的群号' }
    }
  },
  limits: {
    type: 'object',
    description: '限流配置',
    properties: {
      ratePerUserPerHour: { type: 'number', default: 5, description: '每小时每用户请求限制' },
      maxConcurrent: { type: 'number', default: 3, description: '最大并发任务数' },
      taskTimeoutSec: { type: 'number', default: 180, description: '任务超时时间（秒）' },
      cooldownSec: { type: 'number', default: 3, description: '发送消息冷却时间（秒）' }
    }
  },
  filter: {
    type: 'object',
    description: '意图过滤配置',
    properties: {
      enabled: { type: 'boolean', default: true, description: '是否启用意图过滤' }
    }
  }
};

// ========== 工具函数 ==========

function extractText(message: Array<{ type: string; data: any }>): string {
  const parts: string[] = [];
  for (const seg of message) {
    if (seg.type === 'text') {
      parts.push(seg.data?.text || '');
    }
  }
  return parts.join('').trim();
}

function isAtBot(message: Array<{ type: string; data: any }>, botUserId: number): boolean {
  for (const seg of message) {
    if (seg.type === 'at') {
      const qq = seg.data?.qq;
      if (String(qq) === String(botUserId)) {
        return true;
      }
    }
  }
  return false;
}

interface TriggerResult {
  triggered: boolean;
  taskText: string;
}

function checkTrigger(
  text: string, 
  message: Array<{ type: string; data: any }>,
  triggers: { keywords: string[]; atTrigger: boolean; botUserId?: number }
): TriggerResult {
  // 关键词触发
  for (const kw of triggers.keywords) {
    if (text.startsWith(kw)) {
      const taskText = text.slice(kw.length).trim();
      return { triggered: true, taskText: taskText || text };
    }
  }

  // @触发
  if (triggers.atTrigger && triggers.botUserId && isAtBot(message, triggers.botUserId)) {
    return { triggered: true, taskText: text.trim() };
  }

  return { triggered: false, taskText: '' };
}

async function sendText(groupId: number, text: string): Promise<void> {
  if (!ctx) return;
  await cooldown();
  
  // 长文本分段
  const maxLen = 3000;
  if (text.length <= maxLen) {
    await ctx.actions.call('send_group_msg', { group_id: groupId, message: text });
  } else {
    const parts = [];
    for (let i = 0; i < text.length; i += maxLen) {
      parts.push(text.slice(i, i + maxLen));
    }
    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.length > 1 ? `[${i + 1}/${parts.length}]\n` : '';
      await ctx.actions.call('send_group_msg', { group_id: groupId, message: prefix + parts[i] });
      if (i < parts.length - 1) await cooldown();
    }
  }
}

async function sendReply(groupId: number, messageId: number, text: string): Promise<void> {
  if (!ctx) return;
  await cooldown();
  await ctx.actions.call('send_group_msg', {
    group_id: groupId,
    message: [
      { type: 'reply', data: { id: String(messageId) } },
      { type: 'text', data: { text } }
    ]
  });
}

async function sendFile(groupId: number, filePath: string, fileName: string): Promise<void> {
  if (!ctx) return;
  await cooldown();
  await ctx.actions.call('upload_group_file', {
    group_id: groupId,
    file: `file://${filePath}`,
    name: fileName
  });
}

async function cooldown(): Promise<void> {
  const cooldownSec = configManager?.getCooldown() || 3;
  const elapsed = Date.now() - lastSendTime;
  const waitMs = cooldownSec * 1000 - elapsed;
  if (waitMs > 0) {
    await new Promise(r => setTimeout(r, waitMs));
  }
  lastSendTime = Date.now();
}

interface Task {
  taskId: string;
  groupId: number;
  userId: number;
  userNickname: string;
  text: string;
  messageId: number;
  sessionKey: string;
  state: string;
}

async function runTask(task: Task, groupId: number, messageId: number): Promise<void> {
  if (!taskManager || !openClawClient || !fileFetcher) return;

  taskManager.setRunning(task.taskId);
  await sendReply(groupId, messageId, '收到，处理中...');

  // 创建标记文件用于检测新文件
  await fileFetcher.createMarker();

  const result = await openClawClient.executeTask(
    task.text,
    task.sessionKey,
    configManager?.getTaskTimeout() || 180
  );

  if (!result.ok) {
    taskManager.failTask(task.taskId, result.error || '未知错误');
    await sendText(groupId, `任务处理失败: ${result.error || '未知错误'}`);
    return;
  }

  if (result.needInput) {
    taskManager.setWaitingInput(task.taskId);
    await sendText(groupId, result.result || '等待输入...');
    return;
  }

  taskManager.completeTask(task.taskId, result.result || '');

  // 发送文本结果
  await sendText(groupId, result.result || '完成');

  // 检测并获取新文件
  try {
    const newFiles = await fileFetcher.fetchNewFiles();
    if (newFiles.length > 0) {
      for (const filePath of newFiles) {
        const fileName = filePath.split('/').pop() || 'file';
        await sendFile(groupId, filePath, fileName);
      }
    }
  } catch (e) {
    ctx?.log.error(`[OpenClaw] File fetch error: ${e}`);
  }
}

async function continueTask(task: Task, inputText: string, groupId: number, messageId: number): Promise<void> {
  if (!taskManager || !openClawClient || !fileFetcher) return;

  taskManager.setRunning(task.taskId);

  const result = await openClawClient.executeTask(
    inputText,
    task.sessionKey,
    configManager?.getTaskTimeout() || 180
  );

  if (!result.ok) {
    taskManager.failTask(task.taskId, result.error || '未知错误');
    await sendText(groupId, `处理失败: ${result.error || '未知错误'}`);
    return;
  }

  if (result.needInput) {
    taskManager.setWaitingInput(task.taskId);
    await sendText(groupId, result.result || '等待输入...');
    return;
  }

  taskManager.completeTask(task.taskId, result.result || '');
  await sendText(groupId, result.result || '完成');

  // 检测新文件
  try {
    const newFiles = await fileFetcher.fetchNewFiles();
    if (newFiles.length > 0) {
      for (const filePath of newFiles) {
        const fileName = filePath.split('/').pop() || 'file';
        await sendFile(groupId, filePath, fileName);
      }
    }
  } catch (e) {
    ctx?.log.error(`[OpenClaw] File fetch error: ${e}`);
  }
}

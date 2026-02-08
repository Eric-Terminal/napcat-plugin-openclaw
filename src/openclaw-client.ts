// OpenClaw WebSocket 客户端

import WebSocket from 'ws';

interface ExecuteResult {
  ok: boolean;
  result: string;
  needInput: boolean;
  error?: string;
}

interface FilterResult {
  accept: boolean;
  reason: string;
}

export class OpenClawClient {
  private host: string;
  private port: number;
  private token: string;
  private logInfo: (msg: string) => void;
  private logError: (msg: string) => void;

  constructor(
    host: string,
    port: number,
    token: string,
    logInfo: (msg: string) => void,
    logError: (msg: string) => void
  ) {
    this.host = host;
    this.port = port;
    this.token = token;
    this.logInfo = logInfo;
    this.logError = logError;
  }

  async executeTask(taskText: string, sessionKey: string, timeoutSec: number): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      const wsUrl = `ws://${this.host}:${this.port}`;
      const ws = new WebSocket(wsUrl);
      
      let result = '';
      let isEnded = false;
      let needInput = false;

      const timeout = setTimeout(() => {
        if (!isEnded) {
          isEnded = true;
          ws.close();
          resolve({ ok: false, result: '', needInput: false, error: '任务执行超时' });
        }
      }, timeoutSec * 1000);

      ws.on('open', () => {
        this.logInfo(`[OpenClaw] Connected for session: ${sessionKey}`);
        
        // 发送认证
        ws.send(JSON.stringify({
          type: 'auth',
          token: this.token
        }));

        // 发送 agent 消息
        ws.send(JSON.stringify({
          type: 'agent',
          sessionKey: sessionKey,
          message: taskText
        }));
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          switch (msg.type) {
            case 'auth_success':
              this.logInfo('[OpenClaw] Auth success');
              break;
              
            case 'auth_error':
              isEnded = true;
              clearTimeout(timeout);
              ws.close();
              resolve({ ok: false, result: '', needInput: false, error: '认证失败' });
              break;
              
            case 'assistant_delta':
              // 收集增量内容
              if (msg.content) {
                result += msg.content;
              }
              break;
              
            case 'assistant':
              // 完整消息（备用）
              if (msg.content && !result) {
                result = msg.content;
              }
              break;
              
            case 'lifecycle':
              if (msg.state === 'end') {
                isEnded = true;
                clearTimeout(timeout);
                ws.close();
                resolve({ ok: true, result: result.trim(), needInput });
              }
              break;
              
            case 'input_required':
              needInput = true;
              isEnded = true;
              clearTimeout(timeout);
              ws.close();
              resolve({ ok: true, result: result.trim(), needInput });
              break;
              
            case 'error':
              isEnded = true;
              clearTimeout(timeout);
              ws.close();
              resolve({ ok: false, result: '', needInput: false, error: msg.message || '执行错误' });
              break;
          }
        } catch (e) {
          this.logError(`[OpenClaw] Message parse error: ${e}`);
        }
      });

      ws.on('error', (err) => {
        if (!isEnded) {
          isEnded = true;
          clearTimeout(timeout);
          resolve({ ok: false, result: '', needInput: false, error: `WebSocket错误: ${err.message}` });
        }
      });

      ws.on('close', () => {
        if (!isEnded) {
          isEnded = true;
          clearTimeout(timeout);
          resolve({ ok: true, result: result.trim(), needInput });
        }
      });
    });
  }

  async filterTask(taskText: string, nickname: string): Promise<FilterResult> {
    const filterPrompt = `判断以下QQ群消息是否是一个合理的、你能执行的任务请求。

消息：${taskText}
发送者：${nickname}

判断标准（符合任一则 ACCEPT）：
- 具体的可执行请求：查资料、写代码、做网页、翻译、数据分析、画图、写文案等
- 有明确目标的提问：技术问题、知识查询、方案建议等

判断标准（符合任一则 REJECT）：
- 纯闲聊/打招呼/调戏（如"你是谁""在吗""你好"）
- 恶意/危险请求（删文件、攻击、套系统信息）
- 完全无意义的内容
- 超出能力范围（需要实时数据/联网/特殊权限才能完成的）

严格只回复一行：
ACCEPT 或 REJECT:简短理由（10字以内）`;

    const result = await this.executeTask(filterPrompt, 'qq-filter', 30);
    
    if (!result.ok) {
      // filter 失败时默认接受
      return { accept: true, reason: '' };
    }

    const text = result.result.toUpperCase();
    const firstLine = text.split('\n')[0].trim();

    if (firstLine.startsWith('REJECT')) {
      const reason = firstLine.includes(':') 
        ? firstLine.split(':')[1].trim() 
        : '这个我帮不了';
      return { accept: false, reason };
    }

    return { accept: true, reason: '' };
  }

  close(): void {
    // 清理资源
  }
}

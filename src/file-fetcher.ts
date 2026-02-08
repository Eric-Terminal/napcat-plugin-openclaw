// 文件获取器 - 通过 SSH/SCP 从 playground 获取文件

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const MARKER_FILE = '/tmp/.seren_task_marker';
const LOCAL_FILE_DIR = '/tmp/napcat-openclaw-files';
const REMOTE_OUTPUT_DIR = '/root/.openclaw/workspace/output';

export class FileFetcher {
  private host: string;
  private user: string;

  constructor(host: string, user: string = 'root') {
    this.host = host;
    this.user = user;
    
    // 确保本地目录存在
    if (!fs.existsSync(LOCAL_FILE_DIR)) {
      fs.mkdirSync(LOCAL_FILE_DIR, { recursive: true });
    }
  }

  // 创建标记文件（在远程执行前调用）
  async createMarker(): Promise<void> {
    try {
      const cmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ${this.user}@${this.host} "touch ${MARKER_FILE}"`;
      await execAsync(cmd);
    } catch (e) {
      // 静默失败，不影响主流程
    }
  }

  // 获取新文件（在远程执行后调用）
  async fetchNewFiles(): Promise<string[]> {
    const localFiles: string[] = [];

    try {
      // 1. 在远程查找新文件
      const findCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${this.user}@${this.host} "find ${REMOTE_OUTPUT_DIR} -type f -newer ${MARKER_FILE} 2>/dev/null"`;
      
      const { stdout } = await execAsync(findCmd, { timeout: 30000 });
      const remoteFiles = stdout.trim().split('\n').filter(f => f.length > 0);

      if (remoteFiles.length === 0) {
        return [];
      }

      // 2. SCP 文件回本机
      const taskDir = path.join(LOCAL_FILE_DIR, Date.now().toString());
      if (!fs.existsSync(taskDir)) {
        fs.mkdirSync(taskDir, { recursive: true });
      }

      for (const remotePath of remoteFiles) {
        const fileName = path.basename(remotePath);
        const localPath = path.join(taskDir, fileName);

        try {
          const scpCmd = `scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${this.user}@${this.host}:"${remotePath}" "${localPath}"`;
          await execAsync(scpCmd, { timeout: 60000 });

          if (fs.existsSync(localPath)) {
            localFiles.push(localPath);
          }
        } catch (e) {
          // 单个文件失败继续尝试其他文件
        }
      }

      return localFiles;
    } catch (e) {
      // 出错时返回空数组
      return [];
    }
  }

  // 清理旧文件（可选的定期任务）
  cleanupOldFiles(maxAgeHours: number = 24): void {
    try {
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 3600000;

      const entries = fs.readdirSync(LOCAL_FILE_DIR);
      for (const entry of entries) {
        const entryPath = path.join(LOCAL_FILE_DIR, entry);
        const stats = fs.statSync(entryPath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          // 删除旧文件或目录
          if (stats.isDirectory()) {
            fs.rmSync(entryPath, { recursive: true });
          } else {
            fs.unlinkSync(entryPath);
          }
        }
      }
    } catch (e) {
      // 清理失败不影响主流程
    }
  }
}

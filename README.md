# NapCat Plugin - OpenClaw 任务助手

NapCat 原生插件，将 QQ 群消息转换为 OpenClaw Agent 任务执行。

## 功能

- 🔑 关键词触发（可配置）
- 👥 用户白名单 + 群白名单
- ⏱️ 限流控制（每小时/最大并发）
- 🧠 意图过滤（自动判断是否执行任务）
- 🤖 任务执行（WebSocket → OpenClaw Agent）
- 📄 文本结果回群
- 📎 文件检测 + SCP 回传 + 群文件上传
- 💬 每用户固定 session（短期上下文）
- ⚙️ WebUI 配置面板

## 安装

```bash
# 克隆到 NapCat 插件目录
cd /path/to/napcat/plugins
git clone https://github.com/your-repo/napcat-plugin-openclaw.git

# 安装依赖
cd napcat-plugin-openclaw
npm install

# 构建
npm run build
```

## 配置

在 NapCat WebUI 的插件配置页面中设置：

```yaml
openclaw:
  host: "202.47.135.226"
  port: 18789
  token: "your-token"

triggers:
  keywords: ["莲莲帮我"]

whitelist:
  users: [768295235]     # 空数组 = 所有人
  groups: [902106123]    # 空数组 = 所有群

limits:
  ratePerUserPerHour: 5
  maxConcurrent: 3
  taskTimeoutSec: 180
  cooldownSec: 3

filter:
  enabled: true
```

## 使用

在配置的白名单群中，发送消息：

```
莲莲帮我 帮我查一下 Node.js 最新版本
```

插件会自动：
1. 检查权限和限流
2. 判断意图是否合理
3. 执行任务并返回结果
4. 如有文件则上传到群

## 开发

```bash
# 开发模式（自动编译）
npm run watch

# 构建生产版本
npm run build
```

## 协议

MIT

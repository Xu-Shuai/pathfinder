# 探路者（Pathfinder）AI 内容推荐

React + Vite 前端 +（开发时）本地 Node API +（部署时）Vercel Edge API。

面向影视 / 动漫 / 小说的对话式推荐：
- 流式响应（SSE）把上游大模型输出统一为 `text_delta` / `message_stop` / `error`
- 支持 Anthropic Claude 与阿里云通义千问（OpenAI 兼容流式接口）
- 支持埋点 `POST /api/track`（前端用 `navigator.sendBeacon`）
- 可选：阅文开放平台（起点系）元数据候选增强（需要申请并配置官方密钥）

## 功能概览

- `POST /api/chat`：对话推荐（流式 SSE）
- `POST /api/track`：埋点收集（静默失败不影响体验）
- `YUEWEN_ENABLE=true`：启用“阅文候选元数据 + AI 二次排序”，提升“最近/上新”等覆盖面

## 环境要求

- Node.js 18+（建议 20+）

## 本地启动

1. 进入项目目录

```powershell
cd d:\workspace\cursor\pathfinder
```

2. 准备环境变量

```powershell
copy .env.example .env
```

按需编辑 `.env`：
- 选择模型提供方：`AI_PROVIDER=anthropic` 或 `AI_PROVIDER=qwen`
- 填入对应 Key：`ANTHROPIC_API_KEY` 或 `DASHSCOPE_API_KEY`
- 如需启用阅文候选检索：`YUEWEN_ENABLE=true` 并填 `YUEWEN_APP_KEY`

3. 启动（前端 + 本地 API 一起跑）

```powershell
npm run dev
```

默认地址：
- 前端：`http://localhost:5173/`
- 本地 API 端口：`PORT_API`（默认 `8787`，由 Vite 代理 `/api`）

### 分开启动（可选）

只起本地 API：

```powershell
npm run dev:api
```

只起前端：

```powershell
npm run dev:vite
```

## 环境变量说明

详见 `.env.example`。

与本项目核心相关的几组：

- 模型提供方
  - `AI_PROVIDER=anthropic`（Claude）
  - `AI_PROVIDER=qwen`（通义千问，走 OpenAI 兼容）
- Claude
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_MODEL`（可选）
- 通义千问
  - `DASHSCOPE_API_KEY`
  - `QWEN_MODEL`（可选，默认 `qwen-plus`）
- 阅文候选增强（可选）
  - `YUEWEN_ENABLE=true/false`
  - `YUEWEN_APP_KEY`（需要申请后得到）
  - `YUEWEN_APP_TOKEN`（可选，不填会尝试按文档规则推导）

## API 契约

### `POST /api/chat`

请求体：

```json
{
  "messages": [
    { "role": "user", "content": "推荐类似三体的小说" }
  ],
  "preferences": {
    "categories": ["novel", "anime"],
    "summary": "喜欢硬科幻..."
  },
  "stream": true
}
```

响应：流式 SSE，统一为以下事件（每条都形如 `data: {...}\n\n`）：
- `text_delta`：增量文本
- `message_stop`：结束事件（带 `usage`，用于统计 token）
- `error`：错误事件

### `POST /api/track`

请求体（前端以 `sendBeacon` 发送，失败静默）：

```json
{
  "event": "feedback_given",
  "data": {
    "session_id": "abc123",
    "feedback_type": "like",
    "msg_index": 3
  },
  "timestamp": "2026-03-30T14:22:00Z"
}
```

响应：

```json
{ "ok": true }
```

## 架构说明（简版）

- `lib/chatHandler.js`
  - 根据 `AI_PROVIDER` 选择上游（Claude / Qwen）
  - 把上游 SSE 转换为应用 SSE 协议
  - 在满足触发条件且启用 `YUEWEN_ENABLE` 时，先拉取阅文候选元数据并拼入 System Prompt
- `lib/anthropicTransform.js` / `lib/openaiSseTransform.js`
  - 上游 SSE 适配层
- `lib/yuewenClient.js`
  - 阅文候选元数据拉取（`CpNovel`：`booklist` + `bookinfo`）
  - 目前是“采样分页 + AI 二次排序”的策略（当你申请到更多可检索的 action 后可进一步改为关键词检索）

## 部署到 Vercel（可选）

- 前端构建：`npm run build`
- API 路由：
  - `api/chat.js`
  - `api/track.js`

在 Vercel 后台配置环境变量：
- `AI_PROVIDER`
- 对应的 `ANTHROPIC_API_KEY` 或 `DASHSCOPE_API_KEY`
- 如启用阅文：`YUEWEN_ENABLE=true` + `YUEWEN_APP_KEY`

## 注意事项

- 阅文候选检索属于“需要官方授权的合作数据接口”，未申请时请保持 `YUEWEN_ENABLE=false`。
- 本项目不做站点抓取聚合（避免反爬/合规风险），只使用官方接口能返回的结构化元数据。

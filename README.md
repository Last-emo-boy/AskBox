# AskBox - 匿名提问箱系统

一个支持端到端加密的隐私保护问答平台。

## 功能特性

- ✅ 允许匿名提问
- ✅ 回执/二维码取回私密回答
- ✅ 私密回答可一键公开
- ✅ 拆开统计与时间戳
- 🔜 附件支持（TODO）

## 技术栈

### 前端 (apps/web)
- Next.js (App Router) + TypeScript
- IndexedDB（本地存储加密种子与回执信息）
- libsodium.js（sealed box / secretbox / 密钥派生）

### 后端 (apps/api)
- Fastify + TypeScript
- PostgreSQL + Prisma
- Redis（nonce、限流计数）

### 共享包
- `packages/crypto` - 加密工具库
- `packages/shared-types` - 共享类型定义

## 项目结构

```
askbox/
├── apps/
│   ├── web/          # Next.js 前端应用
│   └── api/          # Fastify 后端 API
├── packages/
│   ├── crypto/       # 加密工具库 (libsodium)
│   └── shared-types/ # 共享 TypeScript 类型
├── docs/
│   └── spec.md       # 技术规范文档
└── docker-compose.yml
```

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
# 启动 PostgreSQL 和 Redis
docker compose up -d

# 初始化数据库
pnpm db:push

# 启动开发服务器
pnpm dev
```

### 构建

```bash
pnpm build
```

### 测试

```bash
pnpm test
```

## 文档

- [技术规范](./docs/spec.md)
- [API 文档](./docs/api.md)
- [安全基线](./docs/security.md)

## License

MIT

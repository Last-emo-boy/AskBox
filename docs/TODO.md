# AskBox 开发进度 TODO

> 最后更新: 2026-01-02

---

## Phase 0: 工程与规范落地 ✅

- [x] mono-repo 结构搭建 (`apps/web`, `apps/api`, `packages/crypto`, `packages/shared-types`)
- [x] 规范文档 `docs/spec.md` 完成
- [x] 安全基线文档 `docs/security.md` 完成
- [x] TypeScript 配置 (`tsconfig.base.json`)
- [x] Turborepo 配置 (`turbo.json`)
- [x] pnpm workspace 配置
- [x] Docker Compose 配置 (PostgreSQL + Redis)
- [x] `.gitignore` 配置
- [x] `README.md` 项目说明

**验收标准:**

- [x] 一键启动开发环境 (`docker compose up -d`)
- [x] spec.md 中 API 与字段冻结，版本号 v1

---

## Phase 1: 账户体系 ✅

### 前端

- [x] 创建账户页面 (`/account/create`)
- [x] 导入账户页面 (`/account/import`)
- [x] 账户管理页面 (`/account`) - 导出种子、删除账户
- [x] 本地存储管理 (`lib/storage.ts`) - IndexedDB 封装
- [x] 种子加密存储 (有口令用 Argon2id 派生 KEK)

### 后端

- [x] `POST /v1/auth/challenge` - 请求挑战 nonce
- [x] `POST /v1/auth/verify` - 验证签名，返回 JWT
- [x] 用户表落库 (Prisma schema)
- [x] AuthChallenge 表 (nonce 存储与过期管理)

### 加密库

- [x] `generateSeed()` - 生成 32 字节随机种子
- [x] `deriveAccountKeys()` - 从种子派生签名/加密密钥对
- [x] `encryptSeedWithPassword()` - Argon2id + SecretBox 加密种子
- [x] `decryptSeedWithPassword()` - 解密种子
- [x] `signChallenge()` - Ed25519 签名

**验收标准:**

- [x] 新设备导入 seed 后可复现同一账户公钥
- [x] 登录只依赖签名挑战，不依赖手机号/邮箱

---

## Phase 2: 提问箱创建与分享 ✅

### 前端

- [x] 提问箱列表页面 (`/boxes`)
- [x] 创建提问箱功能
- [x] 显示分享链接

### 后端

- [x] `POST /v1/boxes` - 创建提问箱
- [x] `GET /v1/boxes/{slug}` - 获取提问箱信息
- [x] `GET /v1/owner/boxes` - 获取当前用户的提问箱列表
- [x] Box 表落库

**验收标准:**

- [x] 任意访客打开分享页能看到提问箱

---

## Phase 3: 私密提问 + 拆开统计 ✅

### 前端

- [x] 提问页面 (`/box/[slug]`)
- [x] Sealed Box 加密提问
- [x] 生成回执并保存到本地
- [x] 问题列表页面 (`/questions`)
- [x] 本地解密问题内容
- [x] 标记已拆开

### 后端

- [x] `POST /v1/boxes/{box_id}/questions` - 提交加密问题
- [x] `GET /v1/owner/questions` - 获取问题列表 (支持状态筛选)
- [x] `POST /v1/questions/{question_id}/open` - 标记问题已拆开
- [x] Question 表落库 (含 `opened_at`, `opened_sig`)

### 加密库

- [x] `sealMessage()` - Sealed Box 加密
- [x] `openSealedMessage()` - Sealed Box 解密
- [x] `generateReceiptKeys()` - 生成回执密钥对

**验收标准:**

- [x] 数据库泄露时，问题正文不可读（无箱主私钥无法解密）
- [x] `opened_at` 正确统计、可筛选 unopened/opened

---

## Phase 4: 回答 + 匿名回执 ✅

### 前端

- [x] 回答问题弹窗 (公开/私密选择)
- [x] 公开回答直接提交明文
- [x] 私密回答使用信封加密
- [x] 回执列表页面 (`/receipts`)
- [x] 用回执查看私密回答
- [x] 本地解密私密回答

### 后端

- [x] `POST /v1/questions/{question_id}/answer` - 创建回答 (公开/私密)
- [x] `GET /v1/questions/{question_id}/answer` - 获取公开回答
- [x] `GET /v1/asker/answers` - 提问者用 asker_token 获取回答
- [x] Answer 表落库

### 加密库

- [x] `envelopeEncrypt()` - 信封加密 (DEK + AEAD)
- [x] `envelopeDecrypt()` - 信封解密

**验收标准:**

- [x] 仅提问者可见回答：无回执/无账户私钥不可解密
- [x] 箱主始终可解密（dek_for_owner）

---

## Phase 5: 一键公开 + 风控安全基线 ✅

### 前端

- [x] 基础 UI 框架完成
- [x] 一键公开按钮 (私密回答 → 公开)
- [x] 公开确认弹窗
- [x] 二维码回执导出组件 (`QRCode.tsx`)
- [x] 提问成功后显示回执二维码

### 后端

- [x] `POST /v1/answers/{answer_id}/publish` - 一键公开 API
- [x] `GET /v1/owner/answers/:question_id` - 箱主获取回答详情 API
- [x] 基础速率限制 (`@fastify/rate-limit`)
- [x] 细粒度限流中间件 (`utils/rateLimit.ts`)
  - [x] IP 维度限流
  - [x] box_id 维度限流
  - [x] asker_token 维度限流
  - [x] user_id 维度限流
- [x] Redis 滑动窗口限流算法

### 安全

- [x] 安全日志系统 (`utils/securityLogger.ts`)
  - [x] 结构化安全事件日志
  - [x] 敏感信息自动脱敏
  - [x] 认证事件追踪
  - [x] 限流事件记录
- [x] 错误处理与脱敏 (`utils/errorHandler.ts`)
  - [x] 统一错误响应格式
  - [x] 生产环境错误信息脱敏
  - [x] 自定义业务错误类
- [x] CORS 配置 (via `@fastify/cors`)
- [x] 安全响应头配置 (via `@fastify/helmet`)

### 工程质量

- [x] ESLint 配置 (`.eslintrc.json`)
- [x] Prettier 配置 (`.prettierrc`)
- [x] 格式化脚本 (`pnpm format`)

**验收标准:**

- [x] 一键公开后公开页可访问，且不破坏原私密记录
- [x] 压测下写接口可被限流保护
- [x] 安全日志记录关键事件

---

## Phase 6: Passkeys/WebAuthn (可选) ❌ 未开始

### 前端

- [ ] WebAuthn 注册流程
- [ ] WebAuthn 登录流程
- [ ] 与 seed 账户绑定 UI

### 后端

- [ ] WebAuthn 注册 API
- [ ] WebAuthn 验证 API
- [ ] Credential 表

**验收标准:**

- [ ] 用户可用 passkeys 登录同一账户
- [ ] seed 仍是跨设备/灾备主路径

---

## TODO: 附件/图片支持 ❌ 明确暂不实现

- [ ] `attachments[]` 字段预留
- [ ] 对象存储集成
- [ ] 端到端加密附件
- [ ] 防滥用策略 (扫描、大小限制、配额)

---

## 其他待办事项

### 开发体验

- [x] ESLint 配置 (`.eslintrc.json`)
- [x] Prettier 配置 (`.prettierrc`)
- [x] Husky + lint-staged (`.husky/pre-commit`)
- [x] CI/CD 配置 (`.github/workflows/ci.yml`)
  - [x] Lint & Typecheck job
  - [x] Unit Tests job (with coverage)
  - [x] Build job
  - [x] E2E Tests job (with Playwright)
- [x] 单元测试 - crypto 包 (`packages/crypto/src/index.test.ts`)
- [x] 单元测试 - API 路由 (`apps/api/src/routes/*.test.ts`)
- [x] E2E 测试配置 (`e2e/playwright.config.ts`)
  - [x] Homepage tests
  - [x] Account flow tests
  - [x] Box flow tests

### 功能优化

- [x] 二维码生成 (回执导出) - `QRCode.tsx` 组件
- [ ] 深色模式
- [ ] 多语言支持 (i18n)
- [ ] PWA 支持
- [ ] 问题/回答分页
- [ ] 搜索功能

### 部署

- [ ] 生产环境配置文档
- [ ] Dockerfile
- [ ] Kubernetes 配置
- [ ] CDN 配置
- [ ] 监控告警

---

## 进度统计

| Phase   | 状态      | 完成度 |
| ------- | --------- | ------ |
| Phase 0 | ✅ 完成   | 100%   |
| Phase 1 | ✅ 完成   | 100%   |
| Phase 2 | ✅ 完成   | 100%   |
| Phase 3 | ✅ 完成   | 100%   |
| Phase 4 | ✅ 完成   | 100%   |
| Phase 5 | ✅ 完成   | 100%   |
| Phase 6 | ❌ 未开始 | 0%     |

**总体进度: ~90%** (核心功能 + CI/CD + 测试已完成)

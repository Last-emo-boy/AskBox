# AskBox 安全基线文档

## 1. 密钥管理

### 1.1 生成

- 账户种子（account_seed）：使用 `sodium.randombytes_buf(32)` 生成
- 回执种子（receipt_seed）：每次提问时生成新的 32 字节随机数
- 对称密钥（DEK）：每次加密时生成新的 32 字节随机数

### 1.2 派生

- 签名密钥对：`sodium.crypto_sign_seed_keypair(seed)`
- 加密密钥对：`sodium.crypto_box_seed_keypair(seed)`
- 本地加密密钥（KEK）：`Argon2id(password, salt, { m: 65536, t: 3, p: 4 })`

### 1.3 存储

- 服务端：只存公钥，永不存私钥或种子
- 客户端：种子加密存储在 IndexedDB
  - 无口令：明文存储（需强提示风险）
  - 有口令：Argon2id 派生 KEK 加密后存储

### 1.4 传输

- 所有密钥通过 HTTPS 传输
- 私钥/种子永不上传服务端

### 1.5 销毁

- 使用 `sodium.memzero()` 清零敏感内存
- 登出时清除内存中的密钥材料

### 1.6 泄露应对

- 账户种子泄露：无法撤销，需创建新账户
- 回执种子泄露：仅影响单个问题的回答隐私
- 建议用户定期备份并安全保管种子

---

## 2. 认证安全

### 2.1 挑战-响应

- Nonce 有效期：5 分钟
- Nonce 一次性使用（Redis 记录已使用 nonce）
- 签名算法：Ed25519

### 2.2 会话管理

- JWT 有效期：1 小时
- 支持 Refresh Token（有效期 7 天）
- 敏感操作需重新验证

---

## 3. 速率限制

### 3.1 全局限制

| 端点                 | IP 限制  | 用户限制 |
| -------------------- | -------- | -------- |
| POST /auth/challenge | 10/min   | -        |
| POST /boxes          | 5/hour   | 3/hour   |
| POST /questions      | 50/hour  | -        |
| POST /answer         | 100/hour | 30/hour  |

### 3.2 Box 维度限制

- 单个 box 接收问题：100/hour
- 防止针对性骚扰攻击

### 3.3 限流响应

- 状态码：429 Too Many Requests
- 响应头：`Retry-After: <seconds>`

---

## 4. 输入验证

### 4.1 大小限制

- 问题密文：最大 10KB
- 回答密文：最大 100KB
- slug：3-50 字符，仅允许 `[a-z0-9-]`
- 公钥：固定 32 字节

### 4.2 格式验证

- 所有 base64url 字段验证格式正确性
- UUID 格式验证
- ISO8601 时间戳验证

---

## 5. 日志规范

### 5.1 必须记录

- 认证事件（成功/失败）
- 关键操作（创建 box、提问、回答、公开）
- 速率限制触发
- 错误事件

### 5.2 禁止记录

- account_seed / receipt_seed
- 私钥材料
- access_token / asker_token 明文
- 问题/回答明文或密文
- 用户 IP（可选哈希处理）

### 5.3 日志格式

```json
{
  "timestamp": "2026-01-02T12:00:00Z",
  "level": "info",
  "event": "question.created",
  "user_id": "uuid",
  "box_id": "uuid",
  "question_id": "uuid"
}
```

---

## 6. 错误处理

### 6.1 客户端错误（4xx）

- 不暴露内部实现细节
- 统一错误格式

```json
{
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "The signature verification failed"
  }
}
```

### 6.2 服务端错误（5xx）

- 只返回通用错误信息
- 详细错误记录到内部日志

---

## 7. 部署安全

### 7.1 传输安全

- 强制 HTTPS（HSTS）
- TLS 1.3 优先

### 7.2 CORS

- 严格配置允许的 Origin
- 不允许 `*` 通配符

### 7.3 安全头

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

### 7.4 依赖安全

- 定期运行 `pnpm audit`
- 使用 Dependabot 或 Renovate 自动更新
- 禁止使用已知漏洞的依赖版本

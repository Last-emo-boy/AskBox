# AskBox 技术规范 v1

> 版本: 1.0.0  
> 最后更新: 2026-01-02

---

## 1. 总体技术路线

### 1.1 私密问题

- 前端用箱主公钥做 **sealed box** 加密，服务端只存密文
- 箱主"拆开"时才在本地解密看到正文
- sealed box 特性：仅凭收件人公钥即可匿名加密；收件人能解密与校验完整性，但无法验证发送者身份

### 1.2 仅提问者可见回答

使用"信封加密（envelope encryption）"：

- 回答正文用对称密钥加密（DEK）
- DEK 分别用 sealed box 封装给：箱主与提问者（匿名提问者用"回执密钥"）

### 1.3 一键公开

- 箱主在本地解密私密回答正文后，主动上传"公开版本明文"
- 服务端存 `public_text` 并对外展示

### 1.4 拆开统计与时间戳

- 服务端记录 `opened_at`
- 客户端对"打开事件"做签名上报（`opened_sig`），避免服务端伪造

---

## 2. 身份与密钥规范

### 2.1 箱主账户（可导入）

生成 32 字节随机 `account_seed`，派生两套密钥（强制分离用途）：

| 用途     | 算法    | 派生路径                |
| -------- | ------- | ----------------------- |
| 签名     | Ed25519 | `seed` → `sign_keypair` |
| 加密接收 | X25519  | `seed` → `enc_keypair`  |

**密钥生命周期**：

- 生成：使用 `crypto_sign_seed_keypair` 和 `crypto_box_seed_keypair`
- 存储：加密存储在 IndexedDB（有口令时用 Argon2id 派生 KEK）
- 销毁：`sodium.memzero()` 清零敏感内存
- 轮换：暂不支持，需设计迁移方案

### 2.2 匿名提问回执（Receipt）

匿名提问时，前端生成一次性 `receipt_seed`（32字节），派生：

- `receipt_pub_enc_key`：提交给服务端随问题存档
- `receipt_priv_enc_key`：只留在用户手上（通过二维码/短串回执保存）

**能力边界**：

- 拿到回执的人 = 提问者（能解密"仅提问者可见回答"）
- 回执丢失不可恢复

### 2.3 本地存储加密

用户设置本地口令时：

```
KEK = Argon2id(password, salt, { m: 65536, t: 3, p: 4 })
encrypted_seed = secretbox(seed, KEK)
```

---

## 3. 加密规范

### 3.1 私密问题（Question）

```typescript
// 提问者端
const ciphertext_question = sodium.crypto_box_seal(
  plaintext_question,
  box_pub_enc_key // 箱主公钥
);
```

### 3.2 私密回答（Answer）

```typescript
// 箱主端
const DEK = sodium.randombytes_buf(32); // 随机对称密钥
const nonce = sodium.randombytes_buf(24);

// AAD 防止密文被剪贴到别的对象
const aad = `${answer_id}|${question_id}|v1`;

const ciphertext_answer = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
  plaintext_answer,
  aad,
  null,
  nonce,
  DEK
);

// 封装 DEK 给双方
const dek_for_owner = sodium.crypto_box_seal(DEK, owner_pub_enc_key);
const dek_for_asker = sodium.crypto_box_seal(DEK, receipt_pub_enc_key);
```

### 3.3 一键公开

```typescript
// 客户端解密
const DEK = sodium.crypto_box_seal_open(dek_for_owner, owner_keypair);
const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
  null,
  ciphertext_answer,
  aad,
  nonce,
  DEK
);

// 上传明文
await api.publish(answer_id, { public_text: plaintext });
```

---

## 4. API 规范 v1

### 4.1 认证

#### POST /v1/auth/challenge

请求挑战 nonce

**Request:**

```json
{
  "pub_sign_key": "base64url..."
}
```

**Response:**

```json
{
  "nonce": "base64url...",
  "challenge_id": "uuid",
  "expires_at": "2026-01-02T12:00:00Z"
}
```

#### POST /v1/auth/verify

验证签名

**Request:**

```json
{
  "challenge_id": "uuid",
  "signature": "base64url..."
}
```

**Response:**

```json
{
  "access_token": "jwt...",
  "expires_in": 3600
}
```

### 4.2 提问箱

#### POST /v1/boxes

创建提问箱（需登录）

**Request:**

```json
{
  "slug": "my-box",
  "settings": {
    "allow_anonymous": true,
    "require_captcha": false
  }
}
```

**Response:**

```json
{
  "box_id": "uuid",
  "slug": "my-box",
  "owner_pub_enc_key": "base64url...",
  "created_at": "2026-01-02T12:00:00Z"
}
```

#### GET /v1/boxes/{slug}

获取提问箱信息

**Response:**

```json
{
  "box_id": "uuid",
  "slug": "my-box",
  "settings": {},
  "owner_pub_enc_key": "base64url..."
}
```

### 4.3 提问

#### POST /v1/boxes/{box_id}/questions

提交问题（允许匿名）

**Request:**

```json
{
  "ciphertext_question": "base64url...",
  "receipt_pub_enc_key": "base64url...",
  "client_created_at": "2026-01-02T12:00:00Z"
}
```

**Response:**

```json
{
  "question_id": "uuid",
  "asker_token": "random_token..."
}
```

#### GET /v1/owner/questions

获取问题列表（箱主登录）

**Query:** `?status=unopened|opened|answered`

**Response:**

```json
{
  "questions": [
    {
      "question_id": "uuid",
      "ciphertext_question": "base64url...",
      "created_at": "2026-01-02T12:00:00Z",
      "opened_at": null
    }
  ]
}
```

#### POST /v1/questions/{question_id}/open

标记问题已拆开（箱主登录）

**Request:**

```json
{
  "opened_at": "2026-01-02T12:00:00Z",
  "opened_sig": "base64url..."
}
```

### 4.4 回答

#### POST /v1/questions/{question_id}/answer

回答问题（箱主登录）

**Request (公开):**

```json
{
  "visibility": "public",
  "public_text": "这是公开回答..."
}
```

**Request (私密):**

```json
{
  "visibility": "private",
  "ciphertext_answer": "base64url...",
  "nonce": "base64url...",
  "dek_for_owner": "base64url...",
  "dek_for_asker": "base64url..."
}
```

#### GET /v1/asker/answers

提问者获取回答

**Query:** `?asker_token=...`

**Response (私密):**

```json
{
  "answer_id": "uuid",
  "visibility": "private",
  "ciphertext_answer": "base64url...",
  "nonce": "base64url...",
  "dek_for_asker": "base64url..."
}
```

#### POST /v1/answers/{answer_id}/publish

一键公开（箱主登录）

**Request:**

```json
{
  "public_text": "解密后的明文..."
}
```

---

## 5. 数据库模型

### users

| 字段         | 类型        | 说明             |
| ------------ | ----------- | ---------------- |
| user_id      | uuid        | 主键             |
| pub_sign_key | bytea       | 签名公钥，unique |
| pub_enc_key  | bytea       | 加密公钥         |
| created_at   | timestamptz | 创建时间         |

### boxes

| 字段          | 类型        | 说明             |
| ------------- | ----------- | ---------------- |
| box_id        | uuid        | 主键             |
| slug          | text        | 唯一标识，unique |
| owner_user_id | uuid        | 外键 → users     |
| settings      | jsonb       | 配置             |
| created_at    | timestamptz | 创建时间         |

### questions

| 字段                | 类型        | 说明               |
| ------------------- | ----------- | ------------------ |
| question_id         | uuid        | 主键               |
| box_id              | uuid        | 外键 → boxes       |
| ciphertext_question | bytea       | 加密的问题         |
| receipt_pub_enc_key | bytea       | 回执公钥（可空）   |
| asker_token_hash    | bytea       | token 哈希，unique |
| created_at          | timestamptz | 创建时间           |
| opened_at           | timestamptz | 拆开时间（可空）   |
| opened_sig          | bytea       | 拆开签名（可空）   |

### answers

| 字段              | 类型        | 说明                     |
| ----------------- | ----------- | ------------------------ |
| answer_id         | uuid        | 主键                     |
| question_id       | uuid        | 外键 → questions，unique |
| visibility        | enum        | public/private           |
| public_text       | text        | 公开文本（可空）         |
| ciphertext_answer | bytea       | 加密回答（可空）         |
| nonce             | bytea       | 加密 nonce（可空）       |
| dek_for_owner     | bytea       | 给箱主的 DEK（可空）     |
| dek_for_asker     | bytea       | 给提问者的 DEK（可空）   |
| created_at        | timestamptz | 创建时间                 |
| published_at      | timestamptz | 公开时间（可空）         |

---

## 6. 安全基线

### 6.1 速率限制

- IP 维度：100 req/min
- box_id 维度：50 questions/hour
- asker_token 维度：10 req/min

### 6.2 资源限制

- 问题长度：最大 10KB
- 回答长度：最大 100KB
- slug 长度：3-50 字符

### 6.3 Token 存储

- 所有 token 只存 hash（`sha256(token)`）
- 明文只出现在客户端

### 6.4 日志规范

- 只记录事件与对象 ID
- 不记录 seed/token/明文
- 错误信息不泄露内部细节

---

## 7. 编码约定

- 所有二进制字段统一 **base64url**（API 层传输）
- 数据库用 bytea
- 所有时间戳统一 **UTC（timestamptz）**，API 返回 ISO8601
- 版本号前置：`/v1/...`
- 密文结构携带 `crypto_version`
- 不自研密码学：只用 libsodium / WebCrypto

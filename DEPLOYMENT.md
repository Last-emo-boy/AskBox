# AskBox 部署指南

## 快速部署

### 1. 准备服务器

确保服务器已安装：

- Docker (20.10+)
- Docker Compose (v2+)
- Git

```bash
# 安装 Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

### 2. 克隆项目

```bash
git clone https://github.com/your-username/AskBox.git
cd AskBox
```

### 3. 配置环境变量

```bash
# 复制示例配置
cp .env.production.example .env.production

# 编辑配置文件
nano .env.production
```

**必须配置的变量：**

```env
# 数据库密码（请使用强密码）
POSTGRES_PASSWORD=your_secure_database_password

# JWT 密钥（生成方式：openssl rand -base64 32）
JWT_SECRET=your_jwt_secret_key

# CORS 源（你的域名）
CORS_ORIGIN=https://your-domain.com

# 前端访问 API 的地址
NEXT_PUBLIC_API_URL=https://your-domain.com/api

# 自定义端口（可选）
API_PORT=3001
WEB_PORT=3000
```

### 4. 启动服务

```bash
# 添加执行权限
chmod +x deploy.sh

# 启动所有服务
./deploy.sh start
```

### 5. 验证部署

```bash
# 查看服务状态
./deploy.sh status

# 查看日志
./deploy.sh logs

# 检查健康状态
curl http://localhost:3001/health
```

## 端口配置

在 `.env.production` 中设置自定义端口：

```env
# API 服务端口（默认 3001）
API_PORT=8080

# Web 服务端口（默认 3000）
WEB_PORT=8081
```

## 使用 Nginx 反向代理

### 1. 安装 Nginx

```bash
sudo apt-get install nginx
```

### 2. 配置 Nginx

```bash
# 复制配置文件
sudo cp deploy/nginx.conf /etc/nginx/sites-available/askbox

# 修改域名
sudo nano /etc/nginx/sites-available/askbox
# 将 your-domain.com 替换为你的域名

# 启用配置
sudo ln -s /etc/nginx/sites-available/askbox /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 配置 SSL（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 常用命令

```bash
# 启动服务
./deploy.sh start

# 停止服务
./deploy.sh stop

# 重启服务
./deploy.sh restart

# 查看日志
./deploy.sh logs          # 所有日志
./deploy.sh logs api      # 只看 API 日志
./deploy.sh logs web      # 只看 Web 日志

# 查看状态
./deploy.sh status

# 更新部署
./deploy.sh update

# 备份数据库
./deploy.sh backup

# 恢复数据库
./deploy.sh restore backups/askbox_backup_20260103_120000.sql.gz
```

## 保活机制

Docker Compose 已配置 `restart: always`，容器会在以下情况自动重启：

- 容器崩溃
- 服务器重启
- Docker 守护进程重启

### 配置开机自启

```bash
# 启用 Docker 开机自启
sudo systemctl enable docker

# Docker Compose 服务会自动随 Docker 启动
```

### 健康检查

所有服务都配置了健康检查：

- **API**: 每 30 秒检查 `/health` 端点
- **Web**: 每 30 秒检查首页
- **PostgreSQL**: 每 10 秒执行 `pg_isready`
- **Redis**: 每 10 秒执行 `redis-cli ping`

如果健康检查失败，Docker 会自动重启容器。

## 监控

### 查看资源使用

```bash
docker stats
```

### 设置告警（可选）

可以使用以下工具进行监控：

- Prometheus + Grafana
- Uptime Kuma
- Healthchecks.io

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
./deploy.sh logs

# 检查配置
docker compose -f docker-compose.prod.yml config
```

### 数据库连接失败

```bash
# 检查数据库容器
docker compose -f docker-compose.prod.yml exec postgres psql -U askbox -c "SELECT 1"
```

### 端口被占用

```bash
# 查看端口占用
sudo lsof -i :3000
sudo lsof -i :3001

# 修改 .env.production 中的端口配置
```

## 更新部署

```bash
# 方式 1：使用部署脚本
./deploy.sh update

# 方式 2：手动更新
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 数据备份

### 自动备份（Cron）

```bash
# 编辑 crontab
crontab -e

# 添加每日备份任务（每天凌晨 3 点）
0 3 * * * cd /path/to/AskBox && ./deploy.sh backup
```

### 备份到远程

```bash
# 使用 rclone 同步到云存储
rclone sync ./backups remote:askbox-backups
```

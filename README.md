# AskBox

AskBox是一个基于Node.js的网页应用，允许用户匿名地向指定邮箱的用户提问。用户可以通过邮箱登录来查看和回答收到的问题。

## 开始

本节将指导你如何在本地机器上安装和运行匿名提问箱项目，用于开发和测试目的。

### 先决条件

- Node.js
- MongoDB

### 安装

1. 克隆仓库到本地机器
```bash
git clone <repository-url>
```
2. 进入项目目录
```bash
cd your-app-name
```
3. 安装项目依赖
```bash
npm install
```
4. 创建一个`.env`文件，并根据你的环境配置必要的环境变量（数据库URI、邮件服务凭证等）

5. 启动应用
```bash
npm start
```

## 架构

### `/src`

包含所有源代码。

#### `/api`

API相关文件，组织方式支持API的版本控制。

##### `/v1`

- **`/controllers`**：处理API请求和响应。
- **`/middlewares`**：应用中间件，例如身份验证和错误处理。
- **`/models`**：定义数据模型和数据库架构。
- **`/routes`**：定义API路由，连接路由和控制器。
- **`/services`**：包含业务逻辑，例如发送邮件和用户验证。

#### `/config`

应用配置文件，如数据库连接配置。

#### `/public`

静态文件目录，如HTML和CSS文件。

#### `/utils`

实用程序和帮助函数，如日志记录器和错误处理器。

### `/tests`

包含测试代码和测试用例。

## 环境变量

示例`.env`文件：

```env
DB_URI=mongodb://localhost:27017/your-database
MAIL_SERVICE_API_KEY=your-mail-service-api-key
```

## 贡献

欢迎贡献！请阅读`CONTRIBUTING.md`了解如何为项目作出贡献。

## 许可证

本项目采用Affero General Public License v3 (AGPLv3)。这意味着如果你对软件进行了修改并且运行了修改后的版本，你必须以AGPLv3的形式公开修改后的源代码。

有关详细信息，请参阅`LICENSE`文件。
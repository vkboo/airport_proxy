# 机场订阅代理服务

一个简单的机场订阅链接代理服务，用于统一管理多个订阅链接，避免频繁更换客户端配置。

## 功能特性

- 🚀 基于 Hono 框架，轻量高效
- 🔄 支持主订阅和备用订阅链接
- ☁️ 支持 Vercel 部署
- 🛡️ 透明代理，保持原始订阅格式
- 📱 支持所有主流代理客户端

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `env.example` 为 `.env` 并填入你的订阅链接和API密钥：

```bash
cp env.example .env
```

编辑 `.env` 文件：

```env
PRIMARY_URL=https://your-primary-subscription-url.com/subscription
BACKUP_URL=https://your-backup-subscription-url.com/subscription
PASSWORD=your-secure-password-here
```

### 3. 本地开发

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 4. 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 在 Vercel 项目设置中添加环境变量：
   - `PRIMARY_URL`: 你的主订阅链接
   - `BACKUP_URL`: 你的备用订阅链接（可选）
   - `PASSWORD`: 你的访问密码（用于保护订阅端点）

## API 端点

| 端点 | 描述 | 认证 | 用途 |
|------|------|------|------|
| `GET /` | 服务信息 | ❌ | 查看服务状态和可用端点 |
| `GET /primary` | 主订阅链接 | ✅ | 客户端使用此端点获取主订阅 |
| `GET /backup` | 备用订阅链接 | ✅ | 客户端使用此端点获取备用订阅 |
| `GET /health` | 健康检查 | ❌ | 监控服务状态 |

## 使用方式

### 在客户端中配置

将原来的订阅链接替换为（需要包含访问密码）：

- **主订阅**: `https://your-domain.vercel.app/primary?password=your-password`
- **备用订阅**: `https://your-domain.vercel.app/backup?password=your-password`

### 支持的客户端

- Clash
- V2Ray
- Quantumult X
- Surge
- Shadowrocket
- 其他支持标准订阅格式的客户端

## 项目结构

```
airport_proxy/
├── api/
│   └── index.ts          # 应用逻辑（本地开发和生产环境共用）
├── package.json
├── tsconfig.json
├── vercel.json
├── env.example
├── .gitignore
├── README.md
└── LICENSE
```

## 开发

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建项目
npm run build
```

### 环境变量

| 变量名 | 必需 | 描述 |
|--------|------|------|
| `PRIMARY_URL` | ✅ | 主订阅链接 |
| `BACKUP_URL` | ❌ | 备用订阅链接 |
| `PASSWORD` | ✅ | 访问密码（保护订阅端点） |
| `PORT` | ❌ | 本地开发端口（默认 3000） |
| `NODE_ENV` | ❌ | 运行环境 |

## 故障排除

### 常见问题

1. **订阅链接无法访问**
   - 检查环境变量是否正确设置
   - 确认原始订阅链接是否有效
   - 查看 Vercel 函数日志

2. **客户端无法解析订阅**
   - 确认客户端支持 HTTPS 订阅
   - 检查网络连接
   - 尝试直接访问端点测试

3. **部署失败**
   - 检查 Vercel 环境变量配置
   - 确认 Node.js 版本兼容性
   - 查看构建日志

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本
- 支持主订阅和备用订阅
- Vercel 部署支持
- 基础错误处理

# AI分身市场 - Vercel 免费部署指南

## 方案优势
- ✅ **完全免费**：Vercel免费额度足够小规模使用
- ✅ 部署简单：GitHub一键部署
- ✅ 全球CDN：访问速度快
- ✅ 自动HTTPS

## 部署步骤

### 1. 上传到 GitHub
```bash
cd ai-fenshen-vercel
git init
git add .
git commit -m "AI分身市场后端"
git remote add origin https://github.com/你的用户名/ai-fenshen-backend.git
git push -u origin main
```

### 2. 注册 Vercel
1. 访问 https://vercel.com
2. 用 GitHub 账号登录
3. 点击 "Add New Project"
4. 选择刚才创建的仓库
5. 点击 "Deploy"

### 3. 配置环境变量（可选）
在 Vercel 项目设置中添加强制密钥：
- Key: `JWT_SECRET`
- Value: `ai-fenshen-secret-key-2024`（或自定义）

### 4. 部署完成
- 🌐 管理后台：`https://你的项目.vercel.app/admin`
- 🔌 API地址：`https://你的项目.vercel.app/api`

## 默认登录
- 用户名：`admin`
- 密码：`admin123`

## 项目结构
```
ai-fenshen-vercel/
├── api/
│   └── index.js          # API服务器
├── public/
│   ├── index.html        # 管理后台页面
│   ├── app.js            # 前端逻辑
│   └── style.css         # 样式
├── vercel.json           # Vercel配置
├── package.json          # 依赖配置
└── DEPLOY_TO_VERCEL.md   # 本文档
```

## 注意事项
- 当前使用**内存存储**，重启后会重置数据
- 适合开发和测试，不适合生产环境
- 如需持久化，可后续添加 Vercel Postgres

## 后续升级（可选）
如需数据库，可以：
1. 在 Vercel 中创建 Vercel Postgres
2. 更新 api/index.js 使用数据库
3. 重新部署

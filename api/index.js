/**
 * AI分身市场后端 - Vercel API
 * 使用内存存储，适合小规模使用（<1000用户）
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'ai-fenshen-secret-key-2024';

// ============= 内存数据库 =============
// 生产环境建议使用 Vercel Postgres 或 PlanetScale
const db = {
  users: new Map(),
  avatars: new Map(),
  applications: new Map(),
  tasks: new Map()
};

// 初始化默认管理员
function initDefaultAdmin() {
  if (db.users.size === 0) {
    const adminId = 'admin_001';
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.users.set(adminId, {
      id: adminId,
      username: 'admin',
      password_hash: passwordHash,
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString()
    });
    console.log('✅ 默认管理员已创建: admin / admin123');
  }
}

initDefaultAdmin();

// ============= 认证函数 =============
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function authenticate(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  const token = auth.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return db.users.get(decoded.userId);
}

// ============= 响应工具 =============
function json(data, statusCode = 200) {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

function error(message, statusCode = 500) {
  return json({ error: message }, statusCode);
}

// ============= API 路由 =============
async function handler(req) {
  // 从 URL 对象或字符串解析路径
  let path = '/';
  try {
    const url = new URL(req.url);
    path = url.pathname;
  } catch {
    // 如果 URL 解析失败，直接使用 req.url
    path = req.url || '/';
  }
  
  // 获取路径并移除 /api 前缀（可能重复）
  while (path.startsWith('/api')) {
    path = path.substring(4) || '/';
  }
  const method = req.method;
  
  console.log(`[${method}] ${path}`);
  
  // CORS预检
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  let body = {};
  if (['POST', 'PUT'].includes(method)) {
    try {
      body = await req.json();
    } catch {}
  }
  
  try {
    // 路由匹配
    switch (path) {
      // 健康检查
      case '/health':
        return json({ status: 'ok', time: new Date().toISOString() });
      
      // 认证
      case '/auth/login':
        if (method === 'POST') return await login(body);
        return error('方法不允许', 405);
      
      case '/auth/me':
        if (method === 'GET') return await getMe(req);
        return error('方法不允许', 405);
      
      // 创作者申请
      case '/creators/apply':
        if (method === 'POST') return await applyCreator(body);
        return error('方法不允许', 405);
      
      case '/creators/applications':
        if (method === 'GET') return await getApplications(req, url.searchParams);
        return error('方法不允许', 405);
      
      // 分身管理
      case '/avatars':
        if (method === 'GET') return await getAvatars(url.searchParams);
        if (method === 'POST') return await createAvatar(req, body);
        return error('方法不允许', 405);
      
      // 统计
      case '/stats/overview':
        if (method === 'GET') return await getStatsOverview();
        return error('方法不允许', 405);
      
      // 单个分身操作
      default:
        const avatarMatch = path.match(/^\/avatars\/(.+)$/);
        if (avatarMatch) {
          const id = avatarMatch[1];
          if (method === 'GET') return await getAvatarById(id);
          if (method === 'PUT') return await updateAvatar(req, id, body);
          if (method === 'DELETE') return await deleteAvatar(req, id);
          return error('方法不允许', 405);
        }
        
        const reviewMatch = path.match(/^\/creators\/applications\/(.+)\/review$/);
        if (reviewMatch) {
          const id = reviewMatch[1];
          if (method === 'PUT') return await reviewApplication(req, id, body);
          return error('方法不允许', 405);
        }
        
        return error('接口不存在', 404);
    }
  } catch (err) {
    console.error('Error:', err);
    return error(err.message);
  }
}

// ============= 接口实现 =============

async function login(body) {
  const { username, password } = body;
  if (!username || !password) {
    return error('用户名和密码不能为空', 400);
  }
  
  const user = Array.from(db.users.values()).find(u => u.username === username);
  if (!user) {
    return error('用户名或密码错误', 401);
  }
  
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return error('用户名或密码错误', 401);
  }
  
  if (user.status !== 'active') {
    return error('账户已被禁用', 403);
  }
  
  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role
  });
  
  return json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
}

async function getMe(req) {
  const user = await authenticate(req);
  if (!user) return error('未授权', 401);
  return json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status
  });
}

async function applyCreator(body) {
  const { name, email, expertise, experience, portfolio, motivation } = body;
  if (!name || !email || !expertise) {
    return error('请填写必填字段', 400);
  }
  
  // 检查重复
  const existing = Array.from(db.applications.values()).find(a => a.email === email);
  if (existing) {
    return error('该邮箱已提交过申请', 400);
  }
  
  const id = `app_${Date.now()}`;
  db.applications.set(id, {
    id,
    name,
    email,
    expertise,
    experience: experience || '',
    portfolio: portfolio || '',
    motivation: motivation || '',
    status: 'pending',
    reviewed_by: null,
    review_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  return json({ message: '申请已提交，我们会尽快审核' }, 201);
}

async function getApplications(req, params) {
  const user = await authenticate(req);
  if (!user || user.role !== 'admin') {
    return error('需要管理员权限', 403);
  }
  
  let apps = Array.from(db.applications.values());
  if (params.get('status')) {
    apps = apps.filter(a => a.status === params.get('status'));
  }
  apps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return json({ applications: apps });
}

async function reviewApplication(req, id, body) {
  const user = await authenticate(req);
  if (!user || user.role !== 'admin') {
    return error('需要管理员权限', 403);
  }
  
  const { status, notes } = body;
  if (!['approved', 'rejected'].includes(status)) {
    return error('无效的状态', 400);
  }
  
  const app = db.applications.get(id);
  if (!app) {
    return error('申请不存在', 404);
  }
  
  app.status = status;
  app.review_notes = notes || '';
  app.reviewed_by = user.id;
  app.updated_at = new Date().toISOString();
  
  return json({ message: '审核完成' });
}

async function getAvatars(params) {
  let avatars = Array.from(db.avatars.values()).filter(a => a.status === 'active');
  if (params.get('type')) {
    avatars = avatars.filter(a => a.type === params.get('type'));
  }
  return json({ avatars });
}

async function getAvatarById(id) {
  const avatar = db.avatars.get(id);
  if (!avatar) return error('分身不存在', 404);
  return json({ avatar });
}

async function createAvatar(req, body) {
  const user = await authenticate(req);
  if (!user || user.role !== 'admin') {
    return error('需要管理员权限', 403);
  }
  
  const { name, type, description, pricing, config } = body;
  if (!name || !type || !description) {
    return error('请填写必填字段', 400);
  }
  
  const id = `avatar_${Date.now()}`;
  db.avatars.set(id, {
    id,
    name,
    type,
    description,
    pricing: pricing || {},
    config: config || {},
    status: 'active',
    creator_id: user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  return json({ avatar: { id, name, type, description } }, 201);
}

async function updateAvatar(req, id, body) {
  const user = await authenticate(req);
  if (!user || user.role !== 'admin') {
    return error('需要管理员权限', 403);
  }
  
  const avatar = db.avatars.get(id);
  if (!avatar) return error('分身不存在', 404);
  
  Object.assign(avatar, body, { updated_at: new Date().toISOString() });
  return json({ message: '更新成功' });
}

async function deleteAvatar(req, id) {
  const user = await authenticate(req);
  if (!user || user.role !== 'admin') {
    return error('需要管理员权限', 403);
  }
  
  if (!db.avatars.has(id)) return error('分身不存在', 404);
  db.avatars.delete(id);
  return json({ message: '删除成功' });
}

async function getStatsOverview() {
  return json({
    avatars: { total: db.avatars.size },
    users: { total: db.users.size },
    tasks: { total: db.tasks.size, today: 0 },
    applications: { pending: Array.from(db.applications.values()).filter(a => a.status === 'pending').length },
    revenue: { total: 0 }
  });
}

// ============= Vercel 入口 =============
module.exports = async (req, res) => {
  try {
    // Vercel req 需要包装成类似 fetch Request 的对象
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost';
    const fullUrl = `${protocol}://${host}${req.url}`;
    
    // 构造 request-like 对象
    const request = {
      url: fullUrl,
      method: req.method,
      headers: req.headers,  // Vercel 已经提供了 headers 对象
      json: async () => req.body || {}
    };
    
    const response = await handler(request);
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};

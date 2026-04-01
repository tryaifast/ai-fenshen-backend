// 管理后台 JavaScript
// Vercel API地址 - 自动检测当前域名
const API_BASE = '/api';

// 状态管理
let currentUser = null;
let currentPage = 'dashboard';
let applications = [];
let avatars = [];
let users = [];
let tasks = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// 检查登录状态
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        showMainPage();
        loadDashboard();
    } else {
        showLoginPage();
    }
}

// 显示登录页
function showLoginPage() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('main-page').style.display = 'none';
}

// 显示主页面
function showMainPage() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('main-page').style.display = 'flex';
}

// 设置事件监听
function setupEventListeners() {
    // 登录表单
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // 退出登录
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // 导航菜单
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            switchPage(page);
        });
    });
    
    // 审核弹窗
    document.getElementById('cancel-review').addEventListener('click', closeReviewModal);
    document.getElementById('confirm-review').addEventListener('click', submitReview);
    
    // 筛选器
    document.getElementById('app-status-filter').addEventListener('change', filterApplications);
}

// 登录处理
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            document.getElementById('user-info').textContent = data.user.username;
            showMainPage();
            loadDashboard();
            showNotification('登录成功', 'success');
        } else {
            showNotification(data.error || '登录失败', 'error');
        }
    } catch (error) {
        showNotification('网络错误', 'error');
    }
}

// 退出登录
function handleLogout() {
    localStorage.removeItem('token');
    currentUser = null;
    showLoginPage();
}

// 切换页面
function switchPage(page) {
    currentPage = page;
    
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    
    // 显示目标页面
    document.getElementById(`${page}-page`).style.display = 'block';
    
    // 更新标题
    const titles = {
        dashboard: '仪表盘',
        applications: '创作者申请',
        avatars: '分身管理',
        users: '用户管理',
        tasks: '任务监控',
        settings: '系统配置'
    };
    document.getElementById('page-title').textContent = titles[page];
    
    // 加载页面数据
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'applications':
            loadApplications();
            break;
        case 'avatars':
            loadAvatars();
            break;
        case 'users':
            loadUsers();
            break;
        case 'tasks':
            loadTasks();
            break;
    }
}

// 加载仪表盘数据
async function loadDashboard() {
    try {
        const [overviewRes, trendsRes] = await Promise.all([
            fetch(`${API_BASE}/api/stats/overview`),
            fetch(`${API_BASE}/api/stats/trends`)
        ]);
        
        const overview = await overviewRes.json();
        const trends = await trendsRes.json();
        
        // 更新统计数据
        document.getElementById('stat-avatars').textContent = overview.avatars.total;
        document.getElementById('stat-users').textContent = overview.users.total;
        document.getElementById('stat-tasks').textContent = overview.tasks.today;
        document.getElementById('stat-pending').textContent = overview.applications.pending;
        document.getElementById('app-badge').textContent = overview.applications.pending;
        
        // 更新图表（简化版）
        const chartDiv = document.getElementById('trend-chart');
        chartDiv.innerHTML = trends.trends.map(t => `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="width: 80px; font-size: 12px; color: #6E6E73;">${t.date.slice(5)}</span>
                <div style="flex: 1; height: 24px; background: #F5F5F7; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${Math.min(t.total * 10, 100)}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px;"></div>
                </div>
                <span style="width: 40px; text-align: right; font-size: 12px; font-weight: 600;">${t.total}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('加载仪表盘失败:', error);
    }
}

// 加载申请列表
async function loadApplications() {
    try {
        const response = await fetch(`${API_BASE}/api/creators/applications`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        const data = await response.json();
        applications = data.applications || [];
        
        renderApplications(applications);
    } catch (error) {
        console.error('加载申请失败:', error);
    }
}

// 渲染申请列表
function renderApplications(list) {
    const tbody = document.getElementById('applications-list');
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = list.map(app => `
        <tr>
            <td>${app.id}</td>
            <td>${app.name}</td>
            <td>${app.email}</td>
            <td>${app.expertise}</td>
            <td><span class="status-tag ${app.status}">${getStatusText(app.status)}</span></td>
            <td>${new Date(app.created_at).toLocaleDateString()}</td>
            <td>
                ${app.status === 'pending' ? `
                    <button class="btn btn-sm btn-primary" onclick="openReviewModal(${app.id})">审核</button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
}

// 筛选申请
function filterApplications() {
    const status = document.getElementById('app-status-filter').value;
    const filtered = status 
        ? applications.filter(a => a.status === status)
        : applications;
    renderApplications(filtered);
}

// 打开审核弹窗
let currentReviewId = null;
function openReviewModal(id) {
    currentReviewId = id;
    const app = applications.find(a => a.id === id);
    
    document.getElementById('review-details').innerHTML = `
        <p><strong>姓名:</strong> ${app.name}</p>
        <p><strong>邮箱:</strong> ${app.email}</p>
        <p><strong>专业领域:</strong> ${app.expertise}</p>
        <p><strong>经验:</strong> ${app.experience || '未填写'}</p>
        <p><strong>申请理由:</strong> ${app.motivation || '未填写'}</p>
    `;
    
    document.getElementById('review-modal').style.display = 'flex';
}

// 关闭审核弹窗
function closeReviewModal() {
    document.getElementById('review-modal').style.display = 'none';
    currentReviewId = null;
}

// 提交审核
async function submitReview() {
    if (!currentReviewId) return;
    
    const status = document.getElementById('review-status').value;
    const notes = document.getElementById('review-notes').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/creators/applications/${currentReviewId}/review`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status, notes })
        });
        
        if (response.ok) {
            showNotification('审核完成', 'success');
            closeReviewModal();
            loadApplications();
            loadDashboard();
        } else {
            showNotification('审核失败', 'error');
        }
    } catch (error) {
        showNotification('网络错误', 'error');
    }
}

// 加载分身列表
async function loadAvatars() {
    try {
        const response = await fetch(`${API_BASE}/api/avatars`);
        const data = await response.json();
        avatars = data.avatars || [];
        
        const container = document.getElementById('avatars-list');
        
        if (avatars.length === 0) {
            container.innerHTML = '<p class="empty">暂无分身</p>';
            return;
        }
        
        container.innerHTML = avatars.map(avatar => `
            <div class="avatar-card">
                <h4>${avatar.name}</h4>
                <p>${avatar.description}</p>
                <div class="meta">
                    <span class="status-tag ${avatar.status}">${avatar.status === 'active' ? '运行中' : '已停用'}</span>
                    <span>¥${avatar.pricing?.monthly || 0}/月</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('加载分身失败:', error);
    }
}

// 加载用户列表
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        const data = await response.json();
        users = data.users || [];
        
        const tbody = document.getElementById('users-list');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无用户</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.role === 'admin' ? '管理员' : '用户'}</td>
                <td><span class="status-tag ${user.status}">${user.status === 'active' ? '正常' : '禁用'}</span></td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>-</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('加载用户失败:', error);
    }
}

// 加载任务列表
async function loadTasks() {
    try {
        const response = await fetch(`${API_BASE}/api/tasks`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        const data = await response.json();
        tasks = data.tasks || [];
        
        const tbody = document.getElementById('tasks-list');
        
        if (tasks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无任务</td></tr>';
            return;
        }
        
        tbody.innerHTML = tasks.map(task => `
            <tr>
                <td>#${task.id}</td>
                <td>分身 #${task.avatar_id}</td>
                <td>用户 #${task.user_id}</td>
                <td><span class="status-tag ${task.status}">${getTaskStatusText(task.status)}</span></td>
                <td>${new Date(task.created_at).toLocaleString()}</td>
                <td>${task.completed_at ? new Date(task.completed_at).toLocaleString() : '-'}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('加载任务失败:', error);
    }
}

// 获取状态文本
function getStatusText(status) {
    const map = {
        pending: '待审核',
        approved: '已通过',
        rejected: '已拒绝'
    };
    return map[status] || status;
}

// 获取任务状态文本
function getTaskStatusText(status) {
    const map = {
        pending: '待处理',
        processing: '处理中',
        completed: '已完成',
        failed: '失败'
    };
    return map[status] || status;
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 10px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#34C759' : type === 'error' ? '#FF3B30' : '#007AFF'};
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

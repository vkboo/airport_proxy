import { Hono } from 'hono';
import { config } from 'dotenv';

// 加载环境变量
config();

const app = new Hono();

// 获取订阅内容的辅助函数
async function fetchSubscription(url: string): Promise<Response> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  } catch (error) {
    console.error(`获取订阅失败 (${url}):`, error);
    throw error;
  }
}

// 主路由 - 返回 404 隐藏服务信息
app.get('/', (c) => {
  return c.text('Not Found', 404);
});

// 添加安全头
app.use('*', async (c, next) => {
  // 设置安全头
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  
  await next();
});

// 主订阅链接
app.get('/primary', async (c) => {
  const primaryUrl = process.env.PRIMARY_URL;
  
  if (!primaryUrl) {
    return c.text('Service Unavailable', 503);
  }

  try {
    const response = await fetchSubscription(primaryUrl);
    const content = await response.text();
    
    // 设置正确的 Content-Type
    const contentType = response.headers.get('content-type') || 'text/plain';
    c.header('Content-Type', contentType);
    
    // 不记录敏感内容到日志
    console.log('主订阅请求成功');
    
    return c.text(content);
  } catch (error) {
    // 不记录具体错误信息到日志
    console.log('主订阅获取失败');
    return c.text('Service Unavailable', 503);
  }
});

// 备用订阅链接
app.get('/backup', async (c) => {
  const backupUrl = process.env.BACKUP_URL;
  
  if (!backupUrl) {
    return c.text('Service Unavailable', 503);
  }

  try {
    const response = await fetchSubscription(backupUrl);
    const content = await response.text();
    
    // 设置正确的 Content-Type
    const contentType = response.headers.get('content-type') || 'text/plain';
    c.header('Content-Type', contentType);
    
    // 不记录敏感内容到日志
    console.log('备用订阅请求成功');
    
    return c.text(content);
  } catch (error) {
    // 不记录具体错误信息到日志
    console.log('备用订阅获取失败');
    return c.text('Service Unavailable', 503);
  }
});

// 健康检查
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default app;

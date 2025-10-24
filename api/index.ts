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

// 主路由 - 服务说明
app.get('/', (c) => {
  return c.json({
    service: '机场订阅代理服务',
    version: '1.0.0',
    endpoints: {
      '/primary': '主订阅链接',
      '/backup': '备用订阅链接'
    },
    usage: '在客户端中使用这些端点替换原始订阅链接'
  });
});

// 主订阅链接
app.get('/primary', async (c) => {
  const primaryUrl = process.env.PRIMARY_URL;
  
  if (!primaryUrl) {
    return c.json({ 
      error: 'PRIMARY_URL 环境变量未设置' 
    }, 500);
  }

  try {
    const response = await fetchSubscription(primaryUrl);
    const content = await response.text();
    
    // 设置正确的 Content-Type
    const contentType = response.headers.get('content-type') || 'text/plain';
    c.header('Content-Type', contentType);
    
    return c.text(content);
  } catch (error) {
    console.error('主订阅获取失败:', error);
    return c.json({ 
      error: '无法获取主订阅内容',
      details: error instanceof Error ? error.message : '未知错误'
    }, 502);
  }
});

// 备用订阅链接
app.get('/backup', async (c) => {
  const backupUrl = process.env.BACKUP_URL;
  
  if (!backupUrl) {
    return c.json({ 
      error: 'BACKUP_URL 环境变量未设置' 
    }, 500);
  }

  try {
    const response = await fetchSubscription(backupUrl);
    const content = await response.text();
    
    // 设置正确的 Content-Type
    const contentType = response.headers.get('content-type') || 'text/plain';
    c.header('Content-Type', contentType);
    
    return c.text(content);
  } catch (error) {
    console.error('备用订阅获取失败:', error);
    return c.json({ 
      error: '无法获取备用订阅内容',
      details: error instanceof Error ? error.message : '未知错误'
    }, 502);
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

import { Hono } from 'hono';
import { config } from 'dotenv';
import { Agent } from 'undici';

config();

const app = new Hono();

const insecureAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

function buildForwardUrl(c: any, targetUrl: string): string {
  const upstreamUrl = new URL(targetUrl);
  const incomingUrl = new URL(c.req.url);
  for (const [key, value] of incomingUrl.searchParams.entries()) {
    if (key !== 'password') {
      upstreamUrl.searchParams.append(key, value);
    }
  }
  return upstreamUrl.toString();
}

function buildForwardHeaders(c: any): Headers {
  const headers = new Headers();
  const accept = c.req.header('accept');
  const acceptLanguage = c.req.header('accept-language');
  const userAgent = c.req.header('user-agent');

  headers.set('accept', accept || '*/*');

  if (acceptLanguage) {
    headers.set('accept-language', acceptLanguage);
  }

  headers.set(
    'user-agent',
    userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  return headers;
}

async function forwardGet(c: any, targetUrl: string): Promise<Response> {
  const url = buildForwardUrl(c, targetUrl);
  const headers = buildForwardHeaders(c);
  return fetch(url, {
    method: 'GET',
    headers,
    dispatcher: insecureAgent,
  } as any);
}

// 主路由 - 返回 404 隐藏服务信息
app.get('/', (c) => {
  return c.text('Not Found', 404);
});

// 密码认证中间件
function verifyPassword(c: any): boolean | Response {
  const password = c.req.query('password')?.trim();
  const validPassword = process.env.PASSWORD?.trim();

  if (!validPassword) {
    console.log('PASSWORD 环境变量未设置, 所有环境变量键:', Object.keys(process.env).filter(k => k.includes('PASS') || k.includes('pass')));
    return false;
  }

  if (!password || password !== validPassword) {
    console.log(`密码验证失败 - 收到长度: ${password?.length ?? 0}, 期望长度: ${validPassword.length}`);
    return false;
  }

  return true;
}

function maskSensitiveValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= 4) {
    return `${'*'.repeat(value.length)} (${value.length})`;
  }

  return `${value.slice(0, 2)}***${value.slice(-2)} (${value.length})`;
}

function logIncomingRequest(c: any): void {
  const url = new URL(c.req.url);
  const query = Object.fromEntries(
    Array.from(url.searchParams.entries()).map(([key, value]) => [
      key,
      key === 'password' ? maskSensitiveValue(value) : value,
    ])
  );

  console.log('收到请求', {
    method: c.req.method,
    url: c.req.url,
    pathname: url.pathname,
    query,
    headers: {
      accept: c.req.header('accept') || null,
      'accept-language': c.req.header('accept-language') || null,
      'user-agent': c.req.header('user-agent') || null,
      'x-forwarded-for': c.req.header('x-forwarded-for') || null,
      'x-forwarded-host': c.req.header('x-forwarded-host') || null,
      'x-forwarded-proto': c.req.header('x-forwarded-proto') || null,
      'cf-connecting-ip': c.req.header('cf-connecting-ip') || null,
      'cf-ipcountry': c.req.header('cf-ipcountry') || null,
      host: c.req.header('host') || null,
    },
  });
}

async function logUpstreamResponse(routeName: string, response: Response, targetUrl: string): Promise<void> {
  const diagnostic: Record<string, string | number | null> = {
    route: routeName,
    status: response.status,
    contentType: response.headers.get('content-type'),
    server: response.headers.get('server'),
    location: response.headers.get('location'),
    cacheStatus: response.headers.get('cf-cache-status') || response.headers.get('x-cache'),
    targetHost: new URL(targetUrl).host,
  };

  if (response.ok) {
    console.log('上游请求完成', diagnostic);
    return;
  }

  let bodyPreview = '';
  try {
    bodyPreview = (await response.clone().text()).slice(0, 200);
  } catch (error) {
    bodyPreview = `[读取响应体失败: ${error instanceof Error ? error.message : 'unknown error'}]`;
  }

  console.log('上游请求异常', {
    ...diagnostic,
    bodyPreview,
  });
}

app.use('*', async (c, next) => {
  logIncomingRequest(c);
  await next();
});

app.use('/primary', async (c, next) => {
  const result = verifyPassword(c);
  if (result !== true) {
    const validPassword = process.env.PASSWORD?.trim();
    if (!validPassword) return c.text('Service Unavailable', 503);
    return c.text('Unauthorized', 401);
  }
  await next();
});

app.use('/backup', async (c, next) => {
  const result = verifyPassword(c);
  if (result !== true) {
    const validPassword = process.env.PASSWORD?.trim();
    if (!validPassword) return c.text('Service Unavailable', 503);
    return c.text('Unauthorized', 401);
  }
  await next();
});

// 添加安全头
app.use('*', async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname === '/primary' || pathname === '/backup') {
    await next();
    return;
  }
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
    const response = await forwardGet(c, primaryUrl);
    await logUpstreamResponse('primary', response, primaryUrl);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
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
    const response = await forwardGet(c, backupUrl);
    await logUpstreamResponse('backup', response, backupUrl);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
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

// 本地开发服务器
if (process.env.NODE_ENV !== 'production') {
  const { serve } = await import('@hono/node-server');
  const port = process.env.PORT || 3000;
  console.log(`🚀 服务器启动在 http://localhost:${port}`);
  serve({
    fetch: app.fetch,
    port: Number(port)
  });
}

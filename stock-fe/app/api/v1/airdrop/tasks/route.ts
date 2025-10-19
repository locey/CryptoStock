import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:80';

// 简单的内存缓存，防止频繁请求
let allTasksCache: any = null;
let allTasksCacheTime = 0;
let userTasksCache: Map<string, { data: any; time: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const now = Date.now();

  try {

    // 如果有 userId 参数，使用用户任务缓存
    if (userId) {
      const cacheKey = userId;
      const cached = userTasksCache.get(cacheKey);

      if (cached && (now - cached.time) < CACHE_DURATION) {
        console.log('Returning cached user tasks for:', userId, 'age:', now - cached.time, 'ms');
        return NextResponse.json(cached.data, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Cache-Control': 'max-age=60',
          },
        });
      }

      // 获取用户任务
      const backendUrl = `${BACKEND_URL}/api/v1/airdrop/tasks?userId=${encodeURIComponent(userId)}`;
      console.log('Fetching fresh user tasks from:', backendUrl);

      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Backend response error:', response.status, response.statusText);
        // 如果有缓存，返回过期缓存
        if (cached) {
          console.log('Returning stale cached user tasks due to error');
          return NextResponse.json(cached.data, { status: 200 });
        }
        return NextResponse.json(
          {
            code: response.status,
            message: `Backend error: ${response.statusText}`,
            data: null
          },
          { status: response.status }
        );
      }

      const data = await response.json();

      // 更新用户任务缓存
      userTasksCache.set(cacheKey, { data, time: now });
      console.log('User tasks cached successfully for:', userId);

      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'max-age=60',
        },
      });
    }

    // 如果没有 userId 参数，使用所有任务缓存
    if (allTasksCache && (now - allTasksCacheTime) < CACHE_DURATION) {
      console.log('Returning cached all tasks, age:', now - allTasksCacheTime, 'ms');
      return NextResponse.json(allTasksCache, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'max-age=60',
        },
      });
    }

    // 获取所有任务列表
    const backendUrl = `${BACKEND_URL}/api/v1/airdrop/tasks`;
    console.log('Fetching fresh all tasks from:', backendUrl);

    // 发送请求到后端
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend response error:', response.status, response.statusText);
      // 如果有缓存，返回过期缓存
      if (allTasksCache) {
        console.log('Returning stale cached all tasks due to error');
        return NextResponse.json(allTasksCache, { status: 200 });
      }
      return NextResponse.json(
        {
          code: response.status,
          message: `Backend error: ${response.statusText}`,
          data: null
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 更新所有任务缓存
    allTasksCache = data;
    allTasksCacheTime = now;
    console.log('All tasks cached successfully');

    // 返回后端响应
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'max-age=60',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);

    // 根据请求类型返回相应的缓存数据
    if (userId) {
      const cached = userTasksCache.get(userId);
      if (cached) {
        console.log('Returning stale cached user tasks due to error');
        return NextResponse.json(cached.data, { status: 200 });
      }
    } else {
      if (allTasksCache) {
        console.log('Returning stale cached all tasks due to error');
        return NextResponse.json(allTasksCache, { status: 200 });
      }
    }

    return NextResponse.json(
      {
        code: 500,
        message: 'Internal server error',
        data: null
      },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（CORS预检）
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
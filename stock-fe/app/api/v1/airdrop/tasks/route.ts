import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { code: 400, message: 'user_id parameter is required', data: null },
        { status: 400 }
      );
    }

    // 构建后端API URL - 后端期望的参数名是 userId
    const backendUrl = `${BACKEND_URL}/api/v1/airdrop/tasks?userId=${encodeURIComponent(userId)}`;

    console.log('Proxying request to:', backendUrl);

    // 发送请求到后端
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 添加其他需要的头部信息
      },
    });

    if (!response.ok) {
      console.error('Backend response error:', response.status, response.statusText);
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

    // 返回后端响应
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
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
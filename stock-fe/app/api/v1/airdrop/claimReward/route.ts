import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const body = await request.json();

    // 验证必需字段
    if (!body.user_id || !body.task_id || !body.address) {
      return NextResponse.json(
        {
          code: 400,
          message: 'Missing required fields: user_id, task_id, address',
          data: null
        },
        { status: 400 }
      );
    }

    // 构建后端API URL
    const backendUrl = `${BACKEND_URL}/api/v1/airdrop/claimReward`;

    console.log('Proxying claimReward request to:', backendUrl);
    console.log('Request body:', body);

    // 发送请求到后端
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend response error:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          code: response.status,
          message: errorData.message || `Backend error: ${response.statusText}`,
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
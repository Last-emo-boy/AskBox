import crypto from 'crypto';

import type { FastifyInstance } from 'fastify';

// WeChat JS-SDK signature generation
// Documentation: https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/JS-SDK.html

interface WechatConfig {
  appId: string;
  appSecret: string;
}

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

interface JsTicketCache {
  ticket: string;
  expiresAt: number;
}

let accessTokenCache: AccessTokenCache | null = null;
let jsTicketCache: JsTicketCache | null = null;

function getWechatConfig(): WechatConfig | null {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    return null;
  }

  return { appId, appSecret };
}

async function getAccessToken(config: WechatConfig): Promise<string> {
  // Check cache
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appId}&secret=${config.appSecret}`;

  const response = await fetch(url);
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode) {
    throw new Error(`WeChat API error: ${data.errmsg}`);
  }

  if (!data.access_token) {
    throw new Error('Failed to get access token');
  }

  // Cache with 10 minutes buffer
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in! - 600) * 1000,
  };

  return data.access_token;
}

async function getJsApiTicket(config: WechatConfig): Promise<string> {
  // Check cache
  if (jsTicketCache && jsTicketCache.expiresAt > Date.now()) {
    return jsTicketCache.ticket;
  }

  const accessToken = await getAccessToken(config);
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;

  const response = await fetch(url);
  const data = (await response.json()) as {
    ticket?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode !== 0) {
    throw new Error(`WeChat API error: ${data.errmsg}`);
  }

  if (!data.ticket) {
    throw new Error('Failed to get jsapi ticket');
  }

  // Cache with 10 minutes buffer
  jsTicketCache = {
    ticket: data.ticket,
    expiresAt: Date.now() + (data.expires_in! - 600) * 1000,
  };

  return data.ticket;
}

function generateSignature(
  ticket: string,
  nonceStr: string,
  timestamp: number,
  url: string
): string {
  const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return crypto.createHash('sha1').update(str).digest('hex');
}

function generateNonceStr(): string {
  return crypto.randomBytes(16).toString('hex');
}

export default async function wechatRoutes(fastify: FastifyInstance) {
  // Get WeChat JS-SDK signature for sharing
  fastify.post<{
    Body: { url: string };
  }>('/wechat/signature', async (request, reply) => {
    const config = getWechatConfig();

    if (!config) {
      return reply.status(503).send({
        error: 'WeChat sharing not configured',
        message: '微信分享功能未配置',
      });
    }

    const { url } = request.body;

    if (!url) {
      return reply.status(400).send({
        error: 'URL is required',
      });
    }

    try {
      const ticket = await getJsApiTicket(config);
      const nonceStr = generateNonceStr();
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(ticket, nonceStr, timestamp, url);

      return {
        appId: config.appId,
        timestamp,
        nonceStr,
        signature,
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'WeChat signature error');
      return reply.status(500).send({
        error: 'Failed to generate signature',
        message: '生成签名失败',
      });
    }
  });

  // Check if WeChat sharing is configured
  fastify.get('/wechat/status', async () => {
    const config = getWechatConfig();
    return {
      enabled: !!config,
    };
  });
}

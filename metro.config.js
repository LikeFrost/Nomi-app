const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PROXY_PREFIX = '/api-proxy';
const UPSTREAM = 'https://claude2.sssaicode.com/api';

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .glb 3D model files as assets.
config.resolver.assetExts.push('glb');

const originalEnhance = config.server?.enhanceMiddleware;
config.server = {
  ...(config.server ?? {}),
  enhanceMiddleware: (middleware, server) => {
    const enhanced = originalEnhance ? originalEnhance(middleware, server) : middleware;
    return (req, res, next) => {
      if (!req.url || !req.url.startsWith(PROXY_PREFIX)) {
        return enhanced(req, res, next);
      }

      // CORS preflight + headers (open during dev only)
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access',
      );
      res.setHeader('Access-Control-Max-Age', '86400');
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }

      const upstreamUrl = new URL(UPSTREAM + req.url.slice(PROXY_PREFIX.length));
      const lib = upstreamUrl.protocol === 'http:' ? http : https;

      const headers = { ...req.headers };
      delete headers.host;
      delete headers.origin;
      delete headers.referer;
      delete headers['accept-encoding'];

      const upstreamReq = lib.request(
        {
          method: req.method,
          hostname: upstreamUrl.hostname,
          port: upstreamUrl.port || (upstreamUrl.protocol === 'http:' ? 80 : 443),
          path: upstreamUrl.pathname + upstreamUrl.search,
          headers,
        },
        (upstreamRes) => {
          res.statusCode = upstreamRes.statusCode || 502;
          for (const [k, v] of Object.entries(upstreamRes.headers)) {
            // skip CORS headers from upstream — we set our own above
            if (k.toLowerCase().startsWith('access-control-')) continue;
            if (v != null) res.setHeader(k, v);
          }
          upstreamRes.pipe(res);
        },
      );

      upstreamReq.on('error', (err) => {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: 'proxy_error', message: err.message }));
      });

      req.pipe(upstreamReq);
    };
  },
};

module.exports = config;

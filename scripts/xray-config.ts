import { writeFile } from 'node:fs/promises';
import process from 'node:process';

const HTTP_PORT = 10809;
const SOCKS_PORT = 10808;

function parseVlessUri(uri: string) {
  const url = new URL(uri);
  const uuid = url.username;
  const host = url.hostname;
  const port = parseInt(url.port, 10);
  const params = url.searchParams;

  return {
    uuid,
    address: host,
    port,
    flow: params.get('flow') || '',
    security: params.get('security') || 'none',
    sni: params.get('sni') || host,
    fp: params.get('fp') || 'chrome',
    alpn: (params.get('alpn') || '').split(',').filter(Boolean),
    allowInsecure: params.get('insecure') === '1' || params.get('allowInsecure') === '1',
    type: params.get('type') || 'tcp',
    host: params.get('host') || host,
    path: params.get('path') || '/',
    mode: params.get('mode') || '',
    encryption: params.get('encryption') || 'none',
  };
}

function buildConfig(vless: ReturnType<typeof parseVlessUri>) {
  const streamSettings: Record<string, unknown> = {
    network: vless.type,
    security: vless.security,
  };

  if (vless.security === 'tls') {
    streamSettings.tlsSettings = {
      serverName: vless.sni,
      fingerprint: vless.fp,
      allowInsecure: vless.allowInsecure,
      ...(vless.alpn.length > 0 ? { alpn: vless.alpn } : {}),
    };
  }

  if (vless.type === 'xhttp') {
    streamSettings.xhttpSettings = {
      host: vless.host,
      path: vless.path,
      ...(vless.mode ? { mode: vless.mode } : {}),
    };
  } else if (vless.type === 'ws') {
    streamSettings.wsSettings = {
      path: vless.path,
      headers: { Host: vless.host },
    };
  } else if (vless.type === 'tcp') {
    streamSettings.tcpSettings = {};
  }

  return {
    log: { loglevel: 'warning' },
    inbounds: [
      {
        tag: 'http-in',
        port: HTTP_PORT,
        listen: '127.0.0.1',
        protocol: 'http',
        settings: {},
      },
      {
        tag: 'socks-in',
        port: SOCKS_PORT,
        listen: '127.0.0.1',
        protocol: 'socks',
        settings: { udp: true },
      },
    ],
    outbounds: [
      {
        tag: 'proxy',
        protocol: 'vless',
        settings: {
          vnext: [
            {
              address: vless.address,
              port: vless.port,
              users: [
                {
                  id: vless.uuid,
                  encryption: vless.encryption,
                  flow: vless.flow,
                },
              ],
            },
          ],
        },
        streamSettings,
      },
      {
        tag: 'direct',
        protocol: 'freedom',
        settings: {},
      },
    ],
    routing: {
      rules: [
        {
          type: 'field',
          inboundTag: ['http-in', 'socks-in'],
          outboundTag: 'proxy',
        },
      ],
    },
  };
}

const vlessUri = process.argv[2] || process.env.XRAY_VLESS_URI;
if (!vlessUri) {
  console.error('Usage: bun scripts/xray-config.ts <vless-uri>');
  console.error('  or set XRAY_VLESS_URI environment variable');
  process.exit(1);
}

const vless = parseVlessUri(vlessUri);
const config = buildConfig(vless);
const outputPath = process.argv[3] || '/tmp/xray-config.json';

await writeFile(outputPath, JSON.stringify(config, null, 2));
console.log(`[xray-config] Written to ${outputPath}`);
console.log(`[xray-config] HTTP proxy: http://127.0.0.1:${HTTP_PORT}`);
console.log(`[xray-config] SOCKS proxy: socks5://127.0.0.1:${SOCKS_PORT}`);
console.log(`[xray-config] Server: ${vless.address}:${vless.port} (${vless.type}/${vless.security})`);

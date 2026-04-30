import { writeFile } from 'node:fs/promises';
import process from 'node:process';

const LISTEN_PORT = 10809;

interface VlessParams {
  address: string;
  port: number;
  userId: string;
  encryption: string;
  flow: string;
  security: string;
  sni: string;
  alpn: string[];
  fingerprint: string;
  network: string;
  path: string;
  host: string;
  mode: string;
}

function parseVlessUri(uri: string): VlessParams {
  const match = uri.match(/^vless:\/\/([^@]+)@([^:]+):(\d+)\??(.*)$/);
  if (!match) throw new Error('Invalid VLESS URI format');

  const userId = decodeURIComponent(match[1]!);
  const address = match[2]!;
  const port = parseInt(match[3]!, 10);
  const params = new URLSearchParams(match[4] || '');

  return {
    address,
    port,
    userId,
    encryption: params.get('encryption') || 'none',
    flow: params.get('flow') || '',
    security: params.get('security') || 'tls',
    sni: params.get('sni') || address,
    alpn: (params.get('alpn') || 'h3,h2').split(','),
    fingerprint: params.get('fp') || 'chrome',
    network: params.get('type') || 'tcp',
    path: params.get('path') || '/',
    host: params.get('host') || address,
    mode: params.get('mode') || 'auto',
  };
}

function buildConfig(p: VlessParams): object {
  const streamSettings: Record<string, unknown> = {
    network: p.network,
    security: p.security,
    tlsSettings: {
      allowInsecure: true,
      serverName: p.sni,
      alpn: p.alpn,
      fingerprint: p.fingerprint,
    },
  };

  if (p.network === 'xhttp') {
    streamSettings.xhttpSettings = { path: p.path, host: p.host, mode: p.mode };
  } else if (p.network === 'ws') {
    streamSettings.wsSettings = { path: p.path, headers: { Host: p.host } };
  } else if (p.network === 'grpc') {
    streamSettings.grpcSettings = { serviceName: p.path };
  }

  const user: Record<string, unknown> = {
    id: p.userId,
    encryption: p.encryption,
  };
  if (p.flow) user.flow = p.flow;

  return {
    log: { loglevel: 'warning' },
    inbounds: [
      {
        tag: 'http-in',
        port: LISTEN_PORT,
        listen: '127.0.0.1',
        protocol: 'http',
      },
    ],
    outbounds: [
      {
        tag: 'proxy',
        protocol: 'vless',
        settings: {
          vnext: [{ address: p.address, port: p.port, users: [user] }],
        },
        streamSettings,
      },
      { tag: 'direct', protocol: 'freedom' },
    ],
    routing: {
      domainStrategy: 'AsIs',
      rules: [],
    },
  };
}

const [vlessUri, outputPath] = process.argv.slice(2);
if (!vlessUri || !outputPath) {
  console.error('Usage: bun scripts/xray-config.ts <vless-uri> <output-path>');
  process.exit(1);
}

const params = parseVlessUri(vlessUri);
const config = buildConfig(params);
await writeFile(outputPath, JSON.stringify(config, null, 2));
console.log(`[xray-config] Written config to ${outputPath} (${params.address}:${params.port}, network=${params.network})`);

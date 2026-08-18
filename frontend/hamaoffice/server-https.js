// LAN内の別端末から https でアクセスして getUserMedia (Secure Context制約) を
// 検証するための一時的な開発用サーバー。本番は nginx 側で TLS 終端する想定なので
// このファイルはデプロイ対象に含めない。
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = true;
const app = next({ dev });
const handle = app.getRequestHandler();

const certDir = process.env.CERT_DIR;
const httpsOptions = {
  key: fs.readFileSync(path.join(certDir, 'key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
};

const port = process.env.HTTPS_PORT || 3443;

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on https://0.0.0.0:${port}`);
  });
});

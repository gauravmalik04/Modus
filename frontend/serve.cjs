/**
 * Modus Static Frontend Development Server
 * Zero-dependency local dev server on port 5500 with proper MIME types for ES modules.
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT         = 5500;
const FRONTEND_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
    // Enable CORS for all local dev requests
    res.setHeader('Access-Control-Allow-Origin', '*');

    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') {
        reqPath = '/landing.html';
    }

    let filePath = path.join(FRONTEND_DIR, reqPath);

    // Support extensionless URLs (cleanUrls)
    if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`404 Not Found: ${reqPath}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
        });

        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`\n✨ Modus Frontend running at http://localhost:${PORT}`);
    console.log(`   Landing:  http://localhost:${PORT}/landing.html`);
    console.log(`   Login:    http://localhost:${PORT}/login.html`);
    console.log(`   Library:  http://localhost:${PORT}/library.html\n`);
});

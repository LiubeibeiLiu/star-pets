import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  dir =
    process.env.STAR_PREVIEW_DIR || path.resolve(root, '../../work/preview');
fs.mkdirSync(dir, { recursive: true });
const port = Number(process.env.STAR_PREVIEW_PORT) || 3187;
const host = process.env.FIGMA ? '0.0.0.0' : '127.0.0.1';
const allowedOrigins = new Set([
  'http://127.0.0.1:' + port,
  'http://localhost:' + port,
]);
if (process.env.FIGMA_PUBLIC_URL) {
  try {
    allowedOrigins.add(new URL(process.env.FIGMA_PUBLIC_URL).origin);
  } catch {
    console.warn('FIGMA_PUBLIC_URL is not a valid URL; using local origins only');
  }
}
const file = path.join(dir, 'state.json');
const cookieName = 'star_' + port;
const sessions = new Set();
const salt = 'preview-only';
const expected = crypto.pbkdf2Sync('Admin123', salt, 120000, 32, 'sha256');
let passwordHash = expected;
let rememberedPassword = '';
let rememberedAt = 0;
const rememberFor = 7 * 24 * 60 * 60 * 1000;
const freshRemember = () => {
  if (!rememberedPassword || Date.now() - rememberedAt > rememberFor) {
    rememberedPassword = '';
    rememberedAt = 0;
    return false;
  }
  return true;
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/__preview/')) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin)) {
        res.writeHead(403).end();
        return;
      }
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 34000000) throw Error('Payload too large');
      }
      const a = JSON.parse(raw || '{}'),
        action = url.pathname.slice(11),
        session = (req.headers.cookie || '')
          .split(';')
          .map((s) => s.trim())
          .find((s) => s.startsWith(cookieName + '='))
          ?.slice(cookieName.length + 1);
      const auth = sessions.has(session);
      let result = {};
      const status = () => ({
        authenticated: auth,
        biometric: false,
        bioAvailable: false,
        remembered: freshRemember(),
        version: '1.0.0',
        notifications: false,
      });
      if (action === 'status') result = status();
      else if (action === 'login') {
        const h = crypto.pbkdf2Sync(
          a.password || '',
          salt,
          120000,
          32,
          'sha256',
        );
        if (!crypto.timingSafeEqual(h, passwordHash)) {
          rememberedPassword = '';
          rememberedAt = 0;
          throw Error('密码不正确');
        }
        const token = crypto.randomUUID();
        sessions.add(token);
        if (a.remember) {
          rememberedPassword = a.password;
          rememberedAt = Date.now();
        } else {
          rememberedPassword = '';
          rememberedAt = 0;
        }
        res.setHeader(
          'Set-Cookie',
          `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`,
        );
      } else if (action === 'rememberLogin') {
        if (!freshRemember()) throw Error('保存的密码已超过 7 天，请重新输入');
        const h = crypto.pbkdf2Sync(
          rememberedPassword,
          salt,
          120000,
          32,
          'sha256',
        );
        if (!crypto.timingSafeEqual(h, passwordHash)) {
          rememberedPassword = '';
          rememberedAt = 0;
          throw Error('密码已变化，请重新输入');
        }
        const token = crypto.randomUUID();
        sessions.add(token);
        res.setHeader(
          'Set-Cookie',
          `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`,
        );
      } else if (action === 'forgetLogin') {
        rememberedPassword = '';
        rememberedAt = 0;
      } else if (action === 'bio') {
        const token = crypto.randomUUID();
        sessions.add(token);
        res.setHeader(
          'Set-Cookie',
          `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`,
        );
      } else {
        if (!auth) throw Error('请先解锁应用');
        if (action === 'load')
          result = fs.existsSync(file)
            ? JSON.parse(fs.readFileSync(file, 'utf8'))
            : null;
        else if (action === 'save') {
          const old = fs.existsSync(file)
            ? JSON.parse(fs.readFileSync(file, 'utf8'))
            : null;
          if ((old?.revision || 0) !== a.expected) throw Error('版本冲突');
          fs.writeFileSync(file + '.tmp', JSON.stringify(a.state));
          fs.renameSync(file + '.tmp', file);
        } else if (action === 'photoUpload' || action === 'savePhoto') {
          if (action === 'savePhoto' && process.env.STAR_PREVIEW_SAVE_DELAY_MS)
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                Math.min(
                  10000,
                  Number(process.env.STAR_PREVIEW_SAVE_DELAY_MS) || 0,
                ),
              ),
            );
          const data = Buffer.from(a.data || '', 'base64');
          if (data.length > 22000000 || data[0] !== 255 || data[1] !== 216)
            throw Error('照片格式无效');
          if (a.photoId && !/^[a-f0-9-]{1,64}$/.test(a.photoId))
            throw Error('照片编号无效');
          const name = (a.photoId || crypto.randomUUID()) + '.jpg';
          fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
          if (!fs.existsSync(path.join(dir, 'media', name)))
            fs.writeFileSync(path.join(dir, 'media', name), data);
          result = { file: name };
        } else if (action === 'logout') sessions.delete(session);
        else if (action === 'password') {
          if (
            !crypto.timingSafeEqual(
              crypto.pbkdf2Sync(a.old || '', salt, 120000, 32, 'sha256'),
              passwordHash,
            )
          )
            throw Error('原密码不正确');
          if (a.value.length < 8) throw Error('至少8位');
          passwordHash = crypto.pbkdf2Sync(a.value, salt, 120000, 32, 'sha256');
          rememberedPassword = '';
          rememberedAt = 0;
        } else throw Error('此功能使用 Android 原生接口，请在安装包中验证');
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    }
    if (url.pathname.startsWith('/media/')) {
      const token = (req.headers.cookie || '')
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith(cookieName + '='))
        ?.slice(cookieName.length + 1);
      const name = url.pathname.slice(7);
      if (!sessions.has(token) || !/^[-a-f0-9]+\.jpg$/.test(name)) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader('Content-Type', 'image/jpeg');
      fs.createReadStream(path.join(dir, 'media', name))
        .on('error', () => res.end())
        .pipe(res);
      return;
    }
    const target = path.resolve(
      root,
      'assets/web',
      '.' +
        (url.pathname === '/'
          ? '/index.html'
          : decodeURIComponent(url.pathname)),
    );
    if (
      !target.startsWith(path.join(root, 'assets/web') + path.sep) ||
      !fs.existsSync(target)
    ) {
      res.writeHead(404).end('Not found');
      return;
    }
    const mime =
      {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.json': 'application/json',
      }[path.extname(target)] || 'application/octet-stream';
    const size = fs.statSync(target).size;
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]),
        end = range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
      if (start >= size || end < start) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', end - start + 1);
      fs.createReadStream(target, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', size);
      fs.createReadStream(target).pipe(res);
    }
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});
server.listen(port, host, () =>
  console.log('Preview: http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port),
);

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOT = join(import.meta.dirname, "dist");
const PORT = process.env.PORT || 4173;
const HOST = "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function resolveFile(url) {
  // Strip query/hash
  const path = url.split("?")[0];
  let filePath = join(ROOT, path);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      // Directory → try index.html inside
      filePath = join(filePath, "index.html");
      await stat(filePath);
      return filePath;
    }
    return filePath; // File exists
  } catch {
    // File/dir doesn't exist → SPA fallback to index.html
    return join(ROOT, "index.html");
  }
}

const server = createServer(async (req, res) => {
  try {
    const filePath = await resolveFile(req.url || "/");
    const data = await readFile(filePath);
    const ct = MIME[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": ct });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end("Server error: " + e.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🎮 童趣游戏屋已启动！`);
  console.log(`   本机:   http://localhost:${PORT}/`);
  console.log(`   局域网: http://<本机IP>:${PORT}/`);
  console.log(`   按 Ctrl+C 停止`);
});

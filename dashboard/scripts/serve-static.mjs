// ============================================================
// Zero-dependency static file server for the exported dashboard.
// ============================================================
// WHY THIS EXISTS:
//   `next dev` runs Turbopack with file watchers + HMR and holds
//   hundreds of MB of RAM for as long as it is open. But this
//   dashboard ships as a STATIC EXPORT (next.config: output:"export")
//   and is served by plain Apache in production — there is no Node
//   server on the host at all. So for local testing you never need
//   `next dev`: build once, then serve the static `out/` folder with
//   this tiny server. It uses only Node's built-in `http`/`fs`, starts
//   in well under 30 MB, and exits the moment you press Ctrl+C.
//
// USAGE:
//   node scripts/serve-static.mjs            # serves ./out on :8081
//   node scripts/serve-static.mjs out 9000   # custom dir + port
// ============================================================

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";

const dir = process.argv[2] || "out";
const port = Number(process.argv[3] || 8081);
const root = join(process.cwd(), dir);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

async function resolveFile(urlPath) {
  // Strip query/hash, decode, and guard against path traversal.
  let p = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  let candidate = normalize(join(root, p));
  if (!candidate.startsWith(root)) return null; // traversal attempt

  try {
    const s = await stat(candidate);
    if (s.isDirectory()) candidate = join(candidate, "index.html");
  } catch {
    // `trailingSlash: true` export emits /albums/index.html — try that
    try {
      const asDir = join(candidate, "index.html");
      await stat(asDir);
      candidate = asDir;
    } catch {
      return null;
    }
  }
  return candidate;
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url || "/");
  if (!file) {
    // SPA-ish fallback to the 404 page Next emits, else plain text.
    try {
      const notFound = join(root, "404.html");
      const body = await readFile(notFound);
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error");
  }
});

server.listen(port, () => {
  console.log(`\n  Dashboard (static export) running at http://localhost:${port}\n  Serving: ${root}\n  This mirrors production (static files, no Node server). Ctrl+C to stop.\n`);
});

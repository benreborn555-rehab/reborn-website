/* =========================================================
   Reborn — Local Admin Server (ZERO dependencies)
   Uses only Node.js built-in modules. No "npm install" needed.
   Run:  node server.js     →  http://localhost:3000/admin
   Login: admin / admin
   ========================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const url = require("url");

const ROOT = __dirname;
const CONTENT_FILE = path.join(ROOT, "content.json");
const GALLERY_DIR = path.join(ROOT, "assets", "images", "gallery");

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin";
const PORT = process.env.PORT || 3000;

fs.mkdirSync(GALLERY_DIR, { recursive: true });

const sessions = new Set(); // valid session tokens (in-memory)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

// ---------- helpers ----------
function readContent() {
  try {
    return JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));
  } catch (e) {
    return { site: {}, text: {}, gallery: [] };
  }
}
function writeContent(data) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2), "utf8");
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((c) => {
    const i = c.indexOf("=");
    if (i > -1) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function isAuthed(req) {
  const c = parseCookies(req);
  return c.sid && sessions.has(c.sid);
}
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Cache-Control": "no-store" }, headers || {}));
  res.end(body);
}
function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
}
function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 15 * 1024 * 1024) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function parseUrlEncoded(buf) {
  const out = {};
  buf
    .toString("utf8")
    .split("&")
    .forEach((pair) => {
      const i = pair.indexOf("=");
      if (i > -1) {
        const k = decodeURIComponent(pair.slice(0, i).replace(/\+/g, " "));
        out[k] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
      }
    });
  return out;
}

// Minimal multipart/form-data parser (fields + single file)
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!m) return { fields: {}, files: {} };
  const boundary = "--" + (m[1] || m[2]);
  const fields = {};
  const files = {};
  const bBuf = Buffer.from(boundary);
  let start = buf.indexOf(bBuf);
  while (start !== -1) {
    let next = buf.indexOf(bBuf, start + bBuf.length);
    if (next === -1) break;
    // part is between start+boundary(+CRLF) and next(-CRLF)
    let partStart = start + bBuf.length;
    if (buf[partStart] === 0x0d && buf[partStart + 1] === 0x0a) partStart += 2;
    let partEnd = next;
    if (buf[partEnd - 2] === 0x0d && buf[partEnd - 1] === 0x0a) partEnd -= 2;
    const part = buf.slice(partStart, partEnd);
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const header = part.slice(0, headerEnd).toString("utf8");
      const body = part.slice(headerEnd + 4);
      const nameM = /name="([^"]*)"/i.exec(header);
      const fileM = /filename="([^"]*)"/i.exec(header);
      const name = nameM ? nameM[1] : null;
      if (name) {
        if (fileM && fileM[1]) {
          const ctM = /Content-Type:\s*([^\r\n]+)/i.exec(header);
          files[name] = { filename: fileM[1], type: ctM ? ctM[1].trim() : "", data: body };
        } else {
          fields[name] = body.toString("utf8");
        }
      }
    }
    start = next;
  }
  return { fields, files };
}

function cleanupOrphans(gallery) {
  try {
    const referenced = new Set(gallery.map((g) => path.basename(g.src)).filter(Boolean));
    fs.readdirSync(GALLERY_DIR).forEach((f) => {
      if (!referenced.has(f)) {
        try {
          fs.unlinkSync(path.join(GALLERY_DIR, f));
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// ---------- request handler ----------
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = decodeURIComponent(parsed.pathname);
  const method = req.method.toUpperCase();

  try {
    // --- login page ---
    if (pathname === "/admin/login" && method === "GET") {
      return sendFile(res, path.join(ROOT, "admin", "login.html"));
    }
    if (pathname === "/admin/login" && method === "POST") {
      const body = parseUrlEncoded(await readBody(req));
      if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
        const token = crypto.randomBytes(24).toString("hex");
        sessions.add(token);
        return send(res, 302, "", {
          "Set-Cookie": "sid=" + token + "; HttpOnly; Path=/; SameSite=Lax",
          Location: "/admin",
        });
      }
      return send(res, 302, "", { Location: "/admin/login?error=1" });
    }
    if (pathname === "/admin/logout") {
      const c = parseCookies(req);
      if (c.sid) sessions.delete(c.sid);
      return send(res, 302, "", { Location: "/admin/login" });
    }

    // --- protected admin app ---
    if (pathname === "/admin" || pathname === "/admin/") {
      if (!isAuthed(req)) return send(res, 302, "", { Location: "/admin/login" });
      return sendFile(res, path.join(ROOT, "admin", "app.html"));
    }

    // --- protected API ---
    if (pathname.startsWith("/api/")) {
      if (!isAuthed(req)) return sendJSON(res, 401, { error: "unauthorized" });

      if (pathname === "/api/content" && method === "GET") {
        return sendJSON(res, 200, readContent());
      }
      if (pathname === "/api/content" && method === "POST") {
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        const data = readContent();
        if (body.site && typeof body.site === "object") data.site = body.site;
        if (body.text && typeof body.text === "object") data.text = body.text;
        writeContent(data);
        return sendJSON(res, 200, { ok: true });
      }
      if (pathname === "/api/gallery" && method === "POST") {
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        if (!Array.isArray(body.gallery)) return sendJSON(res, 400, { error: "bad gallery" });
        const data = readContent();
        data.gallery = body.gallery
          .filter((g) => g && g.src)
          .map((g) => ({ src: String(g.src), title: String(g.title || ""), sub: String(g.sub || "") }));
        writeContent(data);
        cleanupOrphans(data.gallery);
        return sendJSON(res, 200, { ok: true, gallery: data.gallery });
      }
      if (pathname === "/api/upload" && method === "POST") {
        const buf = await readBody(req);
        const { fields, files } = parseMultipart(buf, req.headers["content-type"]);
        const file = files.image;
        if (!file || !file.data || !file.data.length) return sendJSON(res, 400, { error: "no file" });
        if (!/^image\//.test(file.type || "")) return sendJSON(res, 400, { error: "רק קבצי תמונה" });
        let ext = (path.extname(file.filename) || ".jpg").toLowerCase();
        if (!/^\.(png|jpe?g|gif|webp|svg)$/.test(ext)) ext = ".jpg";
        const fname = "img-" + Date.now() + "-" + Math.round(Math.random() * 1e5) + ext;
        fs.writeFileSync(path.join(GALLERY_DIR, fname), file.data);
        const data = readContent();
        if (!Array.isArray(data.gallery)) data.gallery = [];
        const entry = { src: "assets/images/gallery/" + fname, title: fields.title || "", sub: fields.sub || "" };
        data.gallery.push(entry);
        writeContent(data);
        return sendJSON(res, 200, { ok: true, entry, gallery: data.gallery });
      }
      if (pathname === "/api/upload-logo" && method === "POST") {
        const buf = await readBody(req);
        const { files } = parseMultipart(buf, req.headers["content-type"]);
        const file = files.logo;
        if (!file || !file.data || !file.data.length) return sendJSON(res, 400, { error: "no file" });
        if (!/^image\//.test(file.type || "")) return sendJSON(res, 400, { error: "רק קבצי תמונה" });
        let ext = (path.extname(file.filename) || ".png").toLowerCase();
        if (!/^\.(png|jpe?g|gif|webp|svg)$/.test(ext)) ext = ".png";
        const fname = "logo_" + Date.now() + ext;
        const targetDir = path.join(ROOT, "assets", "images");
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, fname), file.data);
        const logoUrl = "/assets/images/" + fname;
        return sendJSON(res, 200, { ok: true, logoUrl });
      }
      return sendJSON(res, 404, { error: "not found" });
    }

    // --- block direct access to raw admin html (must go through /admin) ---
    if (pathname.startsWith("/admin/") && /\.(html)$/.test(pathname)) {
      return send(res, 302, "", { Location: "/admin" });
    }

    // --- static site ---
    let rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.normalize(path.join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden");
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) return send(res, 404, "Not found");
      sendFile(res, filePath);
    });
  } catch (e) {
    sendJSON(res, 400, { error: e.message || "error" });
  }
});

server.listen(PORT, () => {
  console.log("\n  Reborn site + admin running (no dependencies)");
  console.log("  ----------------------------------------");
  console.log("  אתר:          http://localhost:" + PORT + "/");
  console.log("  ממשק ניהול:   http://localhost:" + PORT + "/admin");
  console.log("  משתמש: admin  |  סיסמה: admin");
  console.log("  ----------------------------------------\n");
});

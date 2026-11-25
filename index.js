// File Drop — upload any file of any size, download it back, copy its absolute path.
//
// Why this exists: the chat composer has a hard attachment ceiling and no way to
// hand an agent a real filesystem path. This plugin gives you a plain folder on
// the Gateway host plus a chunked HTTP upload path, so a 40 GB disk image is no
// different from a 4 KB text file.
//
// Design notes:
//   * Storage is a real directory (`rootDir`), not a blob store. Files stay
//     addressable as absolute paths for exec, ffmpeg, model loaders, etc.
//   * Uploads are chunked (`PUT` at an explicit offset) instead of one mega
//     request. That keeps every individual request short — the Gateway's Node
//     server has a 5-minute request timeout, and a 40 GB body on a home uplink
//     would never make it. Chunks also make uploads resumable.
//   * Files are pre-allocated with ftruncate, so a chunk can land at any offset.
//   * HTTP routes use `auth: "plugin"`: the Gateway does not gate them, and this
//     plugin mints its own short-lived HMAC token through an authenticated RPC.
//     That lets <a download> and drag-drop work without pasting the Gateway
//     bearer token into a URL.
//   * Nothing can escape `rootDir`: ids are generated, names are sanitized, and
//     every path is verified after resolve().

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readdir, readFile, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { ErrorCodes, errorShape } from "openclaw/plugin-sdk/gateway-runtime";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const ROUTE_PREFIX = "/plugins/file-drop";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_CHUNK_MB = 16;
// Upload sessions with no activity for this long are swept away.
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;
const MAX_NAME_LEN = 180;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function resolveRoot(api) {
  const configured = api.pluginConfig?.rootDir;
  if (typeof configured === "string" && configured.trim()) return resolve(configured.trim());
  const stateDir = process.env.OPENCLAW_STATE_DIR?.trim() || join(homedir(), ".openclaw");
  return join(resolve(stateDir), "file-drop");
}

/** Keep the user's filename readable but strip anything a shell or a path could care about. */
function sanitizeName(raw) {
  const base = basename(String(raw ?? "").replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "");
  const cleaned = base
    .replace(/[/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, MAX_NAME_LEN);
  return cleaned || "file";
}

function withinRoot(root, candidate) {
  const resolved = resolve(candidate);
  return resolved === root || resolved.startsWith(root + sep);
}

function humanBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "?";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function sendJson(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", String(payload.length));
  res.end(payload);
}

function sendText(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(message);
}

async function readJsonBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new Error("body too large");
    chunks.push(chunk);
  }
  if (total === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function diskInfo(root) {
  try {
    const info = await statfs(root);
    return {
      freeBytes: Number(info.bavail) * Number(info.bsize),
      totalBytes: Number(info.blocks) * Number(info.bsize),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// store: index.json beside the files, reconciled with disk on every load
// ---------------------------------------------------------------------------

class FileStore {
  constructor(root, log) {
    this.root = root;
    this.log = log;
    this.indexPath = join(root, ".index.json");
    this.secretPath = join(root, ".token-secret");
    this.uploadsDir = join(root, ".uploads");
    this.entries = new Map();
    this.secret = null;
    this.ready = null;
  }

  init() {
    this.ready ??= this.open();
    return this.ready;
  }

  async open() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await mkdir(this.uploadsDir, { recursive: true, mode: 0o700 });
    try {
      this.secret = (await readFile(this.secretPath, "utf8")).trim();
    } catch {
      this.secret = "";
    }
    if (!this.secret) {
      this.secret = randomBytes(32).toString("hex");
      await writeFile(this.secretPath, `${this.secret}\n`, { mode: 0o600 });
    }
    await this.load();
  }

  async load() {
    this.entries.clear();
    let raw = null;
    try {
      raw = JSON.parse(await readFile(this.indexPath, "utf8"));
    } catch {
      raw = null;
    }
    if (raw && Array.isArray(raw.files)) {
      for (const item of raw.files) {
        if (!item || typeof item.id !== "string" || typeof item.storedName !== "string") continue;
        this.entries.set(item.id, {
          id: item.id,
          name: String(item.name ?? item.storedName),
          storedName: item.storedName,
          size: Number(item.size) || 0,
          mtime: Number(item.mtime) || Date.now(),
          createdAt: Number(item.createdAt) || Date.now(),
          sha256: typeof item.sha256 === "string" ? item.sha256 : null,
        });
      }
    }

    await this.reconcile();
  }

  /**
   * Re-scan the root and keep the in-memory index honest: files that appeared
   * on disk by any other means (scp, mv, the agent writing there) get a row, and
   * rows whose file vanished are dropped. Safe to call on every list request —
   * it is a single readdir plus a stat per name, which is cheap at this scale.
   */
  async reconcile() {
    let names = [];
    try {
      names = await readdir(this.root);
    } catch {
      names = [];
    }
    const known = new Set([...this.entries.values()].map((entry) => entry.storedName));
    let changed = false;
    for (const name of names) {
      if (name.startsWith(".") || known.has(name)) continue;
      try {
        const info = await stat(join(this.root, name));
        if (!info.isFile()) continue;
        const id = randomUUID();
        this.entries.set(id, {
          id,
          name,
          storedName: name,
          size: info.size,
          mtime: info.mtimeMs,
          createdAt: info.birthtimeMs || info.mtimeMs,
          sha256: null,
        });
        changed = true;
      } catch {
        /* raced deletion */
      }
    }

    // Drop index rows whose file is gone.
    for (const entry of [...this.entries.values()]) {
      try {
        await stat(this.pathOf(entry));
      } catch {
        this.entries.delete(entry.id);
        changed = true;
      }
    }
    if (changed) await this.persist();
  }

  /** Sub-directories directly under the root (top-level only; names carry no `/`). */
  async listDirs() {
    const out = [];
    let names = [];
    try {
      names = await readdir(this.root);
    } catch {
      names = [];
    }
    for (const name of names) {
      if (name.startsWith(".")) continue;
      try {
        const info = await stat(join(this.root, name));
        if (info.isDirectory()) out.push({ name, mtime: info.mtimeMs });
      } catch {
        /* raced */
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  }

  /** Create a top-level sub-directory. Returns `{ ok, name }` or `{ error }`. */
  async mkdir(name) {
    const clean = sanitizeName(name);
    if (!clean || clean === "file" || clean === ".") {
      return { error: "目录名不能为空" };
    }
    const full = join(this.root, clean);
    if (!withinRoot(this.root, full)) return { error: "路径不合法" };
    const existing = await stat(full).catch(() => null);
    if (existing) {
      return { error: existing.isDirectory() ? "同名目录已存在" : "同名文件已存在" };
    }
    try {
      await mkdir(full, { mode: 0o700 });
    } catch (error) {
      return { error: String(error?.message ?? error) };
    }
    return { ok: true, name: clean };
  }

  /**
   * Delete several top-level items at once (files or directories, chosen by the
   * caller but re-checked on disk). Directories are removed recursively. Every
   * name is resolved and confined to the root; nothing can escape it.
   */
  async removeMany(items) {
    const results = [];
    for (const item of items) {
      const name = String(item?.name ?? "").trim();
      if (!name || name.startsWith(".")) {
        results.push({ name, ok: false, error: "名称不合法" });
        continue;
      }
      const full = join(this.root, name);
      if (!withinRoot(this.root, full)) {
        results.push({ name, ok: false, error: "路径不合法" });
        continue;
      }
      try {
        const info = await stat(full);
        if (info.isDirectory()) await rm(full, { recursive: true, force: true });
        else await rm(full, { force: true });
        for (const [id, entry] of this.entries) {
          if (entry.storedName === name) this.entries.delete(id);
        }
        results.push({ name, ok: true });
      } catch (error) {
        results.push({ name, ok: false, error: String(error?.message ?? error) });
      }
    }
    await this.persist().catch(() => {});
    return results;
  }

  async persist() {
    const files = [...this.entries.values()].map((entry) => ({
      id: entry.id,
      name: entry.name,
      storedName: entry.storedName,
      size: entry.size,
      mtime: entry.mtime,
      createdAt: entry.createdAt,
      sha256: entry.sha256,
    }));
    const tmp = `${this.indexPath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: 1, files }, null, 2), { mode: 0o600 });
    await rename(tmp, this.indexPath);
  }

  pathOf(entry) {
    return join(this.root, entry.storedName);
  }

  list() {
    return [...this.entries.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id) {
    return this.entries.get(id);
  }

  /** Pick a stored name that does not clobber an existing file. */
  uniqueStoredName(name) {
    const taken = new Set([...this.entries.values()].map((entry) => entry.storedName));
    if (!taken.has(name)) return name;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    for (let i = 2; i < 10000; i += 1) {
      const candidate = `${stem} (${i})${ext}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${stem}-${randomBytes(3).toString("hex")}${ext}`;
  }

  async remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    const full = this.pathOf(entry);
    if (!withinRoot(this.root, full)) return false;
    try {
      await rm(full, { force: true });
    } catch (error) {
      this.log.warn?.(`file-drop: delete failed for ${entry.storedName}: ${String(error)}`);
      return false;
    }
    this.entries.delete(id);
    await this.persist();
    return true;
  }

  sign(payload) {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }

  mintToken() {
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const payload = Buffer.from(JSON.stringify({ exp: expiresAt, n: randomBytes(6).toString("hex") })).toString(
      "base64url",
    );
    return `${payload}.${this.sign(payload)}`;
  }

  verifyToken(token) {
    if (typeof token !== "string") return false;
    const dot = token.indexOf(".");
    if (dot <= 0) return false;
    const payload = token.slice(0, dot);
    const signature = Buffer.from(token.slice(dot + 1));
    const expected = Buffer.from(this.sign(payload));
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      return typeof parsed.exp === "number" && parsed.exp > Date.now();
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// streaming helpers
// ---------------------------------------------------------------------------

/** Stream the request body into `path` starting at `offset`, capped at `maxBytes`. */
async function writeAtOffset(req, path, offset, maxBytes) {
  const handle = await open(path, "r+");
  try {
    let written = 0;
    // Deliberately NOT stream.pipeline(req, ...): pipeline destroys its source when
    // it finishes, which tears down the request socket and makes the reply
    // undeliverable (the file lands on disk but the client hangs). Async iteration
    // gives the same backpressure without owning the request's lifecycle.
    for await (const chunk of req) {
      if (written + chunk.length > maxBytes) throw new Error("chunk exceeds remaining file size");
      let done = 0;
      while (done < chunk.length) {
        const { bytesWritten } = await handle.write(chunk, done, chunk.length - done, offset + written + done);
        if (bytesWritten <= 0) throw new Error("short write");
        done += bytesWritten;
      }
      written += chunk.length;
    }
    return written;
  } finally {
    await handle.close().catch(() => {});
  }
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

/** Send a file as an attachment, honoring a single byte range. */
async function sendFile(req, res, path, name, size) {
  const asciiName = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store");

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = req.headers.range;
  if (typeof range === "string") {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(range.trim());
    if (match) {
      if (match[1]) start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${size}`);
        res.end();
        return;
      }
      status = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    }
  }
  res.statusCode = status;
  res.setHeader("Content-Length", String(end - start + 1));
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  // Same reason as writeAtOffset: keep the response's lifecycle under our control.
  await new Promise((done) => {
    const source = createReadStream(path, { start, end });
    source.on("error", () => {
      res.destroy();
      done();
    });
    res.on("close", () => source.destroy());
    source.pipe(res);
    res.on("finish", done);
  }).catch(() => res.destroy());
}

// ---------------------------------------------------------------------------
// plugin
// ---------------------------------------------------------------------------

export default definePluginEntry({
  id: "file-drop",
  name: "文件中转站",
  description: "上传任意格式、任意大小的文件，支持下载和复制绝对路径。",

  register(api) {
    const root = resolveRoot(api);
    const store = new FileStore(root, api.logger);
    const chunkBytes = Math.min(256, Math.max(1, Number(api.pluginConfig?.chunkMb) || DEFAULT_CHUNK_MB)) * 1024 * 1024;
    const maxFileGb = Number(api.pluginConfig?.maxFileGb);
    const maxFileBytes = Number.isFinite(maxFileGb) && maxFileGb > 0 ? maxFileGb * 1024 ** 3 : 0;

    /** uploadId -> { id, name, storedName, size, partPath, received, updatedAt } */
    const uploads = new Map();

    const tokenFrom = (req) => {
      const header = req.headers.authorization;
      if (typeof header === "string" && /^bearer\s+/iu.test(header)) return header.slice(7).trim();
      try {
        return new URL(req.url ?? "/", "http://localhost").searchParams.get("t") ?? "";
      } catch {
        return "";
      }
    };
    const authorized = (req) => store.verifyToken(tokenFrom(req));

    const describe = (entry) => ({
      id: entry.id,
      name: entry.name,
      path: store.pathOf(entry),
      size: entry.size,
      sizeLabel: humanBytes(entry.size),
      mtime: entry.mtime,
      createdAt: entry.createdAt,
      sha256: entry.sha256,
      type: "file",
      downloadUrl: `${ROUTE_PREFIX}/download/${entry.id}`,
    });

    /**
     * Reap abandoned upload parts, and drop index rows for files that vanished.
     *
     * The directory scan matters on its own: the in-memory map only knows about
     * uploads started by *this* process, so a restarted Gateway would otherwise
     * leave every interrupted `.part` behind forever.
     */
    const sweep = async (force = false) => {
      const now = Date.now();
      for (const [id, upload] of uploads) {
        if (!force && now - upload.updatedAt < STALE_UPLOAD_MS) continue;
        uploads.delete(id);
        await rm(upload.partPath, { force: true }).catch(() => {});
      }
      const parts = await readdir(store.uploadsDir).catch(() => []);
      for (const file of parts) {
        if (!file.endsWith(".part")) continue;
        if (uploads.has(file.slice(0, -5))) continue;
        const full = join(store.uploadsDir, file);
        if (!force) {
          const info = await stat(full).catch(() => null);
          if (info && now - info.mtimeMs < STALE_UPLOAD_MS) continue;
        }
        await rm(full, { force: true }).catch(() => {});
      }
    };

    // ---- RPC: mint an upload/download token ------------------------------
    api.registerGatewayMethod(
      "file_drop.session",
      async ({ respond }) => {
        try {
          await store.init();
          respond(true, {
            token: store.mintToken(),
            expiresAt: Date.now() + TOKEN_TTL_MS,
            basePath: ROUTE_PREFIX,
            chunkBytes,
            maxFileBytes,
            rootDir: root,
            disk: await diskInfo(root),
          });
        } catch (error) {
          api.logger.error?.(`file-drop: session failed: ${String(error)}`);
          respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "Could not open the upload directory"));
        }
      },
      { scope: "operator.read" },
    );

    // ---- agent tool: let the model find dropped paths ---------------------
    api.registerTool({
      name: "file_drop_list",
      label: "列出中转站文件",
      description:
        "列出文件中转站里的文件（含绝对路径）。用户刚上传文件、需要用到它的绝对路径时，先用这个工具查。",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "可选，按文件名做不区分大小写的模糊筛选。" },
          limit: { type: "integer", description: "返回条数上限（默认 50，最大 200）。", minimum: 1, maximum: 200 },
        },
        additionalProperties: false,
      },
      async execute(_toolCallId, params = {}) {
        await store.init();
        const search = typeof params.search === "string" ? params.search.trim().toLowerCase() : "";
        const limit = Math.min(200, Math.max(1, Number(params.limit) || 50));
        const rows = store
          .list()
          .filter((entry) => !search || entry.name.toLowerCase().includes(search))
          .slice(0, limit)
          .map((entry) => ({
            name: entry.name,
            path: store.pathOf(entry),
            size: entry.size,
            sizeLabel: humanBytes(entry.size),
            uploadedAt: new Date(entry.createdAt).toISOString(),
          }));
        const details = { rootDir: root, count: rows.length, files: rows };
        const body =
          rows.length === 0
            ? `${root} 里没有匹配的文件。`
            : `文件中转站目录：${root}\n${rows.map((row) => `${row.path}  (${row.sizeLabel})`).join("\n")}`;
        return { content: [{ type: "text", text: body }], details };
      },
    });

    // ---- HTTP: upload / list / download / delete -------------------------
    api.registerHttpRoute({
      path: ROUTE_PREFIX,
      auth: "plugin",
      match: "prefix",
      handler: async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const segments = url.pathname.slice(ROUTE_PREFIX.length).split("/").filter(Boolean);
        const [head, second, third] = segments;

        try {
          await store.init();

          if (req.method === "POST" && head === "upload" && second === "begin") {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            const body = await readJsonBody(req);
            const size = Number(body.size);
            if (!Number.isFinite(size) || size < 0) {
              return sendJson(res, 400, { error: "size 必须是非负数字" }), true;
            }
            if (maxFileBytes > 0 && size > maxFileBytes) {
              return sendJson(res, 413, { error: `文件超过已配置的上限 ${humanBytes(maxFileBytes)}` }), true;
            }
            const name = sanitizeName(body.name);
            const storedName = store.uniqueStoredName(name);
            const id = randomUUID();
            const partPath = join(store.uploadsDir, `${id}.part`);
            // Pre-allocate: a sparse file lets a chunk land at any offset (resume).
            const handle = await open(partPath, "w+");
            try {
              await handle.truncate(size);
            } finally {
              await handle.close();
            }
            uploads.set(id, { id, name, storedName, size, partPath, received: 0, updatedAt: Date.now() });
            return sendJson(res, 200, { uploadId: id, chunkBytes, name, storedName }), true;
          }

          if (req.method === "PUT" && head === "upload" && second && !third) {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            const upload = uploads.get(second);
            if (!upload) return sendJson(res, 404, { error: "上传会话不存在" }), true;
            const offset = Number(url.searchParams.get("offset") ?? 0);
            if (!Number.isFinite(offset) || offset < 0 || offset > upload.size) {
              return sendJson(res, 400, { error: "offset 超出范围" }), true;
            }
            const written = await writeAtOffset(req, upload.partPath, offset, upload.size - offset);
            upload.received = Math.max(upload.received, offset + written);
            upload.updatedAt = Date.now();
            return sendJson(res, 200, { received: upload.received, size: upload.size }), true;
          }

          if (req.method === "POST" && head === "upload" && third === "complete") {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            const upload = uploads.get(second);
            if (!upload) return sendJson(res, 404, { error: "上传会话不存在" }), true;
            const body = await readJsonBody(req).catch(() => ({}));
            const partInfo = await stat(upload.partPath).catch(() => null);
            if (!partInfo) return sendJson(res, 410, { error: "上传临时文件已丢失，请重新上传" }), true;
            if (partInfo.size !== upload.size) {
              return sendJson(res, 409, { error: `上传未完成（${partInfo.size}/${upload.size} 字节）` }), true;
            }
            let digest = null;
            if (typeof body.sha256 === "string" && body.sha256.trim()) {
              digest = await sha256File(upload.partPath);
              if (digest !== body.sha256.trim().toLowerCase()) {
                return sendJson(res, 422, { error: "校验值不匹配", sha256: digest }), true;
              }
            }
            const finalPath = join(root, upload.storedName);
            if (!withinRoot(root, finalPath)) return sendJson(res, 400, { error: "文件名不合法" }), true;
            await rename(upload.partPath, finalPath);
            const entry = {
              id: upload.id,
              name: upload.name,
              storedName: upload.storedName,
              size: upload.size,
              mtime: partInfo.mtimeMs || Date.now(),
              createdAt: Date.now(),
              sha256: digest,
            };
            store.entries.set(entry.id, entry);
            await store.persist();
            uploads.delete(upload.id);
            return sendJson(res, 200, { file: describe(entry) }), true;
          }

          if (req.method === "POST" && head === "upload" && third === "abort") {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            const upload = uploads.get(second);
            if (upload) {
              uploads.delete(upload.id);
              await rm(upload.partPath, { force: true }).catch(() => {});
            }
            return sendJson(res, 200, { ok: true }), true;
          }

          if (req.method === "GET" && head === "files" && !second) {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
            const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 500));
            // Pick up files that landed on disk after this process started
            // (hand-copied, scp, agent writes, etc.) before serving the list.
            await store.reconcile();
            const files = store
              .list()
              .filter((entry) => !search || entry.name.toLowerCase().includes(search))
              .slice(0, limit)
              .map(describe);
            const dirs = await store.listDirs().then((d) => d.map((d) => ({
              id: `dir:${d.name}`,
              name: d.name,
              path: join(root, d.name),
              size: 0,
              sizeLabel: "目录",
              mtime: d.mtime,
              createdAt: d.mtime,
              sha256: null,
              type: "dir",
              downloadUrl: null,
            })));
            const all = files.concat(dirs);
            return sendJson(res, 200, { rootDir: root, count: all.length, files: all }), true;
          }

          if ((req.method === "GET" || req.method === "HEAD") && head === "download" && second) {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            const entry = store.get(second);
            if (!entry) return sendText(res, 404, "未找到"), true;
            const full = store.pathOf(entry);
            if (!withinRoot(root, full)) return sendText(res, 400, "路径不合法"), true;
            const info = await stat(full).catch(() => null);
            if (!info?.isFile()) return sendText(res, 404, "未找到"), true;
            await sendFile(req, res, full, entry.name, info.size);
            return true;
          }

          if (req.method === "POST" && head === "delete") {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            const body = await readJsonBody(req);
            // Multi-select: delete several top-level files/directories at once.
            if (Array.isArray(body.items) && body.items.length > 0) {
              const results = await store.removeMany(body.items);
              const ok = results.every((r) => r.ok);
              return sendJson(res, 200, { ok, results }), true;
            }
            const single = await store.remove(String(body.id ?? ""));
            return sendJson(res, single ? 200 : 404, { ok: single }), true;
          }

          if (req.method === "POST" && head === "mkdir") {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            const body = await readJsonBody(req);
            const result = await store.mkdir(String(body.name ?? ""));
            if (result.error) return sendJson(res, 400, { error: result.error }), true;
            return sendJson(res, 200, { ok: true, name: result.name }), true;
          }

          if (req.method === "GET" && head === "stats") {
            if (!authorized(req)) return sendText(res, 401, "未授权"), true;
            await sweep();
            return (
              sendJson(res, 200, {
                rootDir: root,
                count: store.entries.size,
                chunkBytes,
                maxFileBytes,
                disk: await diskInfo(root),
                activeUploads: [...uploads.values()].map((upload) => ({
                  uploadId: upload.id,
                  name: upload.name,
                  received: upload.received,
                  size: upload.size,
                })),
              }),
              true
            );
          }

          return sendJson(res, 404, { error: "未找到" }), true;
        } catch (error) {
          api.logger.warn?.(`file-drop: ${req.method} ${url.pathname} failed: ${String(error)}`);
          if (!res.headersSent) sendJson(res, 500, { error: String(error?.message ?? error) });
          else res.destroy();
          return true;
        }
      },
    });

    api.registerService({
      id: "file-drop",
      start: async () => {
        await store.init();
        // Nothing in `uploads` survives a restart, so every `.part` on disk at
        // startup is an orphan from an interrupted upload. Clear them now rather
        // than waiting out the staleness window.
        await sweep(true);
        api.logger.info?.(`文件中转站：存放目录 ${root}`);
      },
      stop: async () => {},
    });
  },
});
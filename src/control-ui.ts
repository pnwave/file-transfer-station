// File Drop — native Control UI page.
//
// Everything here runs inside the Control UI origin with the signed-in
// operator's Gateway authority. That gives us `host.request` (to mint the
// short-lived file-drop token) and `host.basePath` (so the Gateway's control UI
// mount point, e.g. `/openclaw`, is respected when building route URLs).

import { defineControlUiPlugin } from "openclaw/plugin-sdk/control-ui";

const STYLE_ID = "file-drop-styles";

type FileEntry = {
  id: string;
  name: string;
  path: string;
  size: number;
  sizeLabel: string;
  mtime: number;
  createdAt: number;
  sha256: string | null;
  type: "file" | "dir";
  downloadUrl: string | null;
};

type UploadItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  sent: number;
  phase: "uploading" | "hashing" | "finalizing" | "done" | "error";
  error: string;
};

type SessionInfo = {
  token: string;
  chunkBytes: number;
  rootDir: string;
  maxFileBytes: number;
  disk: { freeBytes: number; totalBytes: number } | null;
};

function errText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const CSS = `
.fd-page {
  --fd-gap: 14px;
  display: flex;
  flex-direction: column;
  gap: var(--fd-gap);
  padding: 20px;
  max-width: 1080px;
  margin: 0 auto;
  font-family: inherit;
  color: var(--text, #e8e8e8);
  box-sizing: border-box;
}
.fd-page * { box-sizing: border-box; }
.fd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.fd-title { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
.fd-sub { margin: 4px 0 0; font-size: 13px; color: var(--muted-foreground, #9aa0a6); line-height: 1.5; }
.fd-root { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--muted-foreground, #9aa0a6); word-break: break-all; }
.fd-drop {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; min-height: 168px; padding: 24px;
  border: 1.5px dashed var(--border-strong, #4a4a4a);
  border-radius: 14px;
  background: var(--bg-muted, rgba(255,255,255,0.03));
  text-align: center; cursor: pointer;
  transition: border-color .15s ease, background .15s ease, transform .1s ease;
}
.fd-drop:hover { border-color: var(--primary, #6aa9ff); background: var(--bg-hover, rgba(255,255,255,0.06)); }
.fd-drop.fd-over { border-color: var(--primary, #6aa9ff); background: var(--accent-subtle, rgba(106,169,255,0.12)); transform: scale(1.005); }
.fd-drop-icon { font-size: 28px; line-height: 1; opacity: .85; }
.fd-drop-main { font-size: 14px; font-weight: 600; }
.fd-drop-hint { font-size: 12px; color: var(--muted-foreground, #9aa0a6); }
.fd-drop input[type="file"] { display: none; }
.fd-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.fd-btn {
  appearance: none; border: 1px solid var(--border, #3a3a3a);
  background: var(--bg-elevated, rgba(255,255,255,0.05));
  color: var(--text, #e8e8e8);
  border-radius: 9px; padding: 7px 13px; font: inherit; font-size: 13px;
  cursor: pointer; transition: border-color .12s ease, background .12s ease;
  white-space: nowrap;
}
.fd-btn:hover { border-color: var(--border-hover, #5a5a5a); background: var(--bg-hover, rgba(255,255,255,0.09)); }
.fd-btn:disabled { opacity: .45; cursor: default; }
.fd-btn.fd-primary { background: var(--primary, #3b82f6); border-color: transparent; color: var(--primary-foreground, #fff); font-weight: 600; }
.fd-btn.fd-primary:hover { background: var(--primary-hover, #2f6fe0); }
.fd-btn.fd-danger { color: var(--danger, #f87171); border-color: color-mix(in srgb, var(--danger, #f87171) 40%, transparent); }
.fd-btn.fd-danger:hover { background: var(--danger-subtle, rgba(248,113,113,0.12)); }
.fd-search {
  flex: 1 1 200px; min-width: 140px;
  background: var(--bg-muted, rgba(255,255,255,0.04));
  border: 1px solid var(--border, #3a3a3a); border-radius: 9px;
  padding: 7px 11px; font: inherit; font-size: 13px; color: inherit;
}
.fd-search:focus { outline: 2px solid var(--primary, #3b82f6); outline-offset: -1px; }
.fd-queue { display: flex; flex-direction: column; gap: 8px; }
.fd-item, .fd-file {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 11px;
  border: 1px solid var(--border, #33363c);
  background: var(--card, rgba(255,255,255,0.03));
}
.fd-item { flex-direction: column; align-items: stretch; gap: 6px; }
.fd-item-head { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
.fd-item-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-item-meta { color: var(--muted-foreground, #9aa0a6); font-size: 12px; flex: none; }
.fd-bar { position: relative; height: 7px; border-radius: 99px; background: var(--bg-muted, rgba(255,255,255,0.08)); overflow: hidden; }
.fd-bar > span { position: absolute; inset: 0 auto 0 0; width: 0%; background: var(--primary, #3b82f6); border-radius: 99px; transition: width .12s linear; }
.fd-bar.fd-error > span { background: var(--danger, #f87171); }
.fd-bar.fd-done > span { background: var(--success, #4ade80); }
.fd-file { gap: 8px; }
.fd-file-check { flex: none; width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary, #3b82f6); }
.fd-file-body { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 3px; }
.fd-file-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-file-name .fd-dir-icon { margin-right: 4px; opacity: .8; }
.fd-file-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px;
  color: var(--muted-foreground, #9aa0a6);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;
}
.fd-file-path:hover { color: var(--text, #e8e8e8); }
.fd-file-meta { font-size: 11.5px; color: var(--text-tertiary, #808690); flex: none; }
.fd-file-actions { display: flex; gap: 6px; flex: none; }
.fd-empty, .fd-error, .fd-loading {
  padding: 26px; text-align: center; font-size: 13px;
  color: var(--muted-foreground, #9aa0a6);
  border: 1px dashed var(--border, #33363c); border-radius: 12px;
}
.fd-error { color: var(--danger, #f87171); border-color: color-mix(in srgb, var(--danger, #f87171) 35%, transparent); }
.fd-toast {
  position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
  padding: 9px 16px; border-radius: 999px; font-size: 13px;
  background: var(--text-strong, #111); color: var(--bg, #fff);
  box-shadow: 0 8px 26px rgba(0,0,0,.35); z-index: 9999;
  opacity: 0; transition: opacity .18s ease; pointer-events: none;
}
.fd-toast.fd-show { opacity: .96; }
.fd-mkdir-row { display: none; gap: 6px; align-items: center; }
.fd-mkdir-row.fd-show { display: flex; }
.fd-mkdir-input {
  width: 200px;
  background: var(--bg-muted, rgba(255,255,255,0.04));
  border: 1px solid var(--border, #3a3a3a); border-radius: 9px;
  padding: 7px 11px; font: inherit; font-size: 13px; color: inherit;
}
.fd-mkdir-input:focus { outline: 2px solid var(--primary, #3b82f6); outline-offset: -1px; }
@media (max-width: 640px) {
  .fd-page { padding: 14px; }
  .fd-file { flex-wrap: wrap; }
  .fd-file-actions { width: 100%; justify-content: flex-end; }
}
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

function bytes(n: number) {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return "?";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function when(ms: number) {
  if (!ms) return "";
  const date = new Date(ms);
  const delta = Date.now() - ms;
  if (delta < 60_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return date.toLocaleDateString("zh-CN");
}

export default defineControlUiPlugin({
  id: "file-drop",

  activate(host) {
    host.ui.registerNavigation({ id: "file-drop", label: "文件中转站", page: { id: "file-drop" }, icon: "upload", order: 60 });

    host.ui.registerPage({
      id: "file-drop",
      label: "文件中转站",
      mount(container, context) {
        ensureStyles();

        const state: {
          token: string | null;
          chunkBytes: number;
          rootDir: string;
          files: FileEntry[];
          loading: boolean;
          error: string;
          queue: Map<string, UploadItem>;
          search: string;
          busy: boolean;
          selected: Set<string>;
        } = {
          token: null,
          chunkBytes: 16 * 1024 * 1024,
          rootDir: "",
          files: [],
          loading: true,
          error: "",
          queue: new Map(),
          search: "",
          busy: false,
          selected: new Set(),
        };
        // Aborted when the view goes away; also used for in-flight fetch.
        const requestAbort = new AbortController();
        const stop = () => {
          requestAbort.abort();
          if (context.signal.aborted) return;
        };
        context.signal.addEventListener("abort", stop, { once: true });

        const api = (path: string, init?: RequestInit) => {
          const base = host.basePath && host.basePath !== "/" ? host.basePath.replace(/\/+$/, "") : "";
          const url = `${base}${path}`;
          const headers = new Headers(init?.headers ?? {});
          if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
          return fetch(url, { ...init, headers, signal: init?.signal ?? requestAbort.signal });
        };

        // ---------- DOM skeleton ----------
        const page = document.createElement("div");
        page.className = "fd-page";

        const head = document.createElement("div");
        head.className = "fd-head";
        const headings = document.createElement("div");
        const title = document.createElement("h1");
        title.className = "fd-title";
        title.textContent = "文件中转站";
        const sub = document.createElement("p");
        sub.className = "fd-sub";
        sub.textContent = "什么格式都能传，多大都行。文件直接落到这台机器的真实文件夹里 —— 复制绝对路径，想在哪用就在哪用。";
        const rootLine = document.createElement("div");
        rootLine.className = "fd-root";
        headings.append(title, sub, rootLine);
        const refreshBtn = document.createElement("button");
        refreshBtn.className = "fd-btn";
        refreshBtn.type = "button";
        refreshBtn.textContent = "刷新";
        head.append(headings, refreshBtn);

        // ---------- drop zone ----------
        const drop = document.createElement("label");
        drop.className = "fd-drop";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = true;
        const dropIcon = document.createElement("div");
        dropIcon.className = "fd-drop-icon";
        dropIcon.textContent = "⬆";
        const dropMain = document.createElement("div");
        dropMain.className = "fd-drop-main";
        dropMain.textContent = "把文件拖到这里，或点击选择";
        const dropHint = document.createElement("div");
        dropHint.className = "fd-drop-hint";
        dropHint.textContent = "不限大小、不限格式。文件夹请逐个文件拖入。";
        drop.append(fileInput, dropIcon, dropMain, dropHint);

        const queueBox = document.createElement("div");
        queueBox.className = "fd-queue";

        // ---------- list ----------
        const listTools = document.createElement("div");
        listTools.className = "fd-row";
        const search = document.createElement("input");
        search.className = "fd-search";
        search.type = "search";
        search.placeholder = "按文件名筛选…";
        search.setAttribute("aria-label", "按文件名筛选");
        const countLabel = document.createElement("span");
        countLabel.className = "fd-file-meta";

        const mkdirBtn = document.createElement("button");
        mkdirBtn.className = "fd-btn";
        mkdirBtn.type = "button";
        mkdirBtn.textContent = "📁 新建目录";
        mkdirBtn.style.display = "none";
        listTools.append(search, countLabel, mkdirBtn);

        const list = document.createElement("div");
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.style.gap = "8px";

        // ---------- mkdir input row ----------
        const mkdirRow = document.createElement("div");
        mkdirRow.className = "fd-mkdir-row";
        const mkdirInput = document.createElement("input");
        mkdirInput.className = "fd-mkdir-input";
        mkdirInput.type = "text";
        mkdirInput.placeholder = "目录名称…";
        mkdirInput.maxLength = 180;
        const mkdirConfirmBtn = document.createElement("button");
        mkdirConfirmBtn.className = "fd-btn fd-primary";
        mkdirConfirmBtn.type = "button";
        mkdirConfirmBtn.textContent = "创建";
        const mkdirCancelBtn = document.createElement("button");
        mkdirCancelBtn.className = "fd-btn";
        mkdirCancelBtn.type = "button";
        mkdirCancelBtn.textContent = "取消";
        mkdirRow.append(mkdirInput, mkdirConfirmBtn, mkdirCancelBtn);

        // ---------- batch delete bar ----------
        const deleteBar = document.createElement("div");
        deleteBar.className = "fd-row";
        deleteBar.style.display = "none";
        const deleteBarLabel = document.createElement("span");
        deleteBarLabel.className = "fd-file-meta";
        deleteBarLabel.textContent = "已选择 0 项";
        const deleteAllBtn = document.createElement("button");
        deleteAllBtn.className = "fd-btn fd-danger";
        deleteAllBtn.type = "button";
        deleteAllBtn.textContent = "删除所选";
        deleteAllBtn.disabled = true;
        const cancelSelectBtn = document.createElement("button");
        cancelSelectBtn.className = "fd-btn";
        cancelSelectBtn.type = "button";
        cancelSelectBtn.textContent = "取消选择";
        const batchDownloadBtn = document.createElement("button");
        batchDownloadBtn.className = "fd-btn fd-primary";
        batchDownloadBtn.type = "button";
        batchDownloadBtn.textContent = "批量下载";
        batchDownloadBtn.disabled = true;
        batchDownloadBtn.onclick = () => {
          const targets = state.files.filter(f => state.selected.has(f.id) && f.type !== "dir");
          if (targets.length === 0) { say("没有可下载的文件（目录不支持批量下载）"); return; }
          batchDownloadBtn.disabled = true;
          let idx = 0;
          const next = () => {
            if (idx >= targets.length) {
              batchDownloadBtn.disabled = false;
              say(`批量下载完成：${targets.length} 个文件`);
              return;
            }
            const f = targets[idx++];
            startDownload(f);
            setTimeout(next, 800);
          };
          next();
        };
        deleteBar.append(deleteBarLabel, batchDownloadBtn, deleteAllBtn, cancelSelectBtn);

        const toast = document.createElement("div");
        toast.className = "fd-toast";

        page.append(head, drop, queueBox, listTools, mkdirRow, deleteBar, list);
        container.append(page, toast);
        let toastTimer = 0;
        const say = (message: string) => {
          toast.textContent = message;
          toast.classList.add("fd-show");
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => toast.classList.remove("fd-show"), 1900);
        };

        // ---------- render: queued uploads ----------
        const renderQueue = () => {
          queueBox.replaceChildren();
          for (const item of state.queue.values()) {
            const row = document.createElement("div");
            row.className = "fd-item";
            const headRow = document.createElement("div");
            headRow.className = "fd-item-head";
            const name = document.createElement("span");
            name.className = "fd-item-name";
            name.textContent = item.name;
            const meta = document.createElement("span");
            meta.className = "fd-item-meta";
            const bar = document.createElement("div");
            bar.className = "fd-bar";
            if (item.phase === "error") bar.classList.add("fd-error");
            if (item.phase === "done") bar.classList.add("fd-done");
            const fill = document.createElement("span");
            bar.append(fill);
            headRow.append(name, meta);
            row.append(headRow, bar);
            queueBox.append(row);

            const pct = item.size > 0 ? Math.min(100, (item.sent / item.size) * 100) : 100;
            fill.style.width = `${pct.toFixed(2)}%`;
            if (item.phase === "error") meta.textContent = `失败 —— ${item.error ?? "未知错误"}`;
            else if (item.phase === "done") meta.textContent = "已完成";
            else if (item.phase === "hashing") meta.textContent = "校验中…";
            else if (item.phase === "finalizing") meta.textContent = "收尾中…";
            else meta.textContent = `${bytes(item.sent)} / ${bytes(item.size)} · ${pct.toFixed(0)}%`;
          }
        };

        // ---------- render: uploaded files + dirs ----------
        const renderFiles = () => {
          const fileCount = state.files.filter(f => f.type !== "dir").length;
          const dirCount = state.files.filter(f => f.type === "dir").length;
          let label = "";
          if (fileCount > 0 && dirCount > 0) label = `${fileCount} 个文件 + ${dirCount} 个目录`;
          else if (fileCount > 0) label = `${fileCount} 个文件`;
          else if (dirCount > 0) label = `${dirCount} 个目录`;
          countLabel.textContent = label;

          list.replaceChildren();
          if (state.loading) {
            const box = document.createElement("div");
            box.className = "fd-loading";
            box.textContent = "加载中…";
            list.append(box);
            return;
          }
          if (state.error) {
            const box = document.createElement("div");
            box.className = "fd-error";
            box.textContent = state.error;
            list.append(box);
            return;
          }
          const needle = state.search.trim().toLowerCase();
          const rows = filterFiles(state.files, needle);
          if (rows.length === 0) {
            const box = document.createElement("div");
            box.className = "fd-empty";
            box.textContent = needle ? "没有匹配的文件或目录。" : "还没有文件，往上面拖一个吧。";
            list.append(box);
            return;
          }
          for (const file of rows) {
            const row = document.createElement("div");
            row.className = "fd-file";
            const isDir = file.type === "dir";

            // checkbox
            const check = document.createElement("input");
            check.type = "checkbox";
            check.className = "fd-file-check";
            check.checked = state.selected.has(file.id);
            check.onchange = () => {
              if (check.checked) state.selected.add(file.id);
              else state.selected.delete(file.id);
              updateDeleteBar();
            };

            const body = document.createElement("div");
            body.className = "fd-file-body";
            const name = document.createElement("div");
            name.className = "fd-file-name";
            if (isDir) {
              const icon = document.createElement("span");
              icon.className = "fd-dir-icon";
              icon.textContent = "📁";
              name.append(icon);
            }
            name.append(document.createTextNode(file.name));
            name.title = file.name;
            const path = document.createElement("div");
            path.className = "fd-file-path";
            path.textContent = file.path;
            path.title = "点击复制绝对路径";
            path.onclick = async () => {
              const ok = await copyText(file.path);
              say(ok ? "路径已复制" : "复制失败，请手动选中复制");
            };
            body.append(name, path);

            const meta = document.createElement("div");
            meta.className = "fd-file-meta";
            if (isDir) {
              meta.textContent = `目录 · ${when(file.mtime)}`;
            } else {
              meta.textContent = `${file.sizeLabel} · ${when(file.createdAt)}`;
            }

            const actions = document.createElement("div");
            actions.className = "fd-file-actions";

            if (!isDir) {
              const copyBtn = document.createElement("button");
              copyBtn.className = "fd-btn";
              copyBtn.type = "button";
              copyBtn.textContent = "复制路径";
              copyBtn.onclick = async () => {
                const ok = await copyText(file.path);
                say(ok ? "路径已复制" : "复制失败，请手动选中复制");
              };
              actions.append(copyBtn);
            }

            if (!isDir) {
              const downloadBtn = document.createElement("button");
              downloadBtn.className = "fd-btn";
              downloadBtn.type = "button";
              downloadBtn.textContent = "下载";
              downloadBtn.onclick = () => startDownload(file);
              actions.append(downloadBtn);
            }

            // single delete (in addition to batch)
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "fd-btn fd-danger";
            deleteBtn.type = "button";
            deleteBtn.textContent = isDir ? "删除目录" : "删除";
            deleteBtn.onclick = async () => {
              deleteBtn.disabled = true;
              try {
                const res = await api("/plugins/file-drop/delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ items: [{ name: file.name }] }),
                });
                if (!res.ok) {
                  const detail = (await res.json().catch(() => ({}))) as { error?: string };
                  throw new Error(detail.error ?? `HTTP ${res.status}`);
                }
                const body = (await res.json()) as { ok: boolean; results?: Array<{ name: string; ok: boolean; error?: string }> };
                if (body.results && body.results.length > 0 && !body.results[0].ok) {
                  throw new Error(body.results[0].error ?? "删除失败");
                }
                state.files = state.files.filter((item) => item.id !== file.id);
                state.selected.delete(file.id);
                renderFiles();
                say(`已删除 ${file.name}`);
              } catch (error) {
                say(`删除失败：${errText(error)}`);
                deleteBtn.disabled = false;
              }
            };
            actions.append(deleteBtn);

            row.append(check, body, meta, actions);
            list.append(row);
          }
          updateDeleteBar();
        };

        const updateDeleteBar = () => {
          const count = state.selected.size;
          deleteBar.style.display = count > 0 ? "flex" : "none";
          deleteBarLabel.textContent = `已选择 ${count} 项`;
          deleteAllBtn.disabled = count === 0;
          batchDownloadBtn.disabled = count === 0;
        };

        // ---------- data ----------
        const loadSession = async () => {
          const session = await host.request<SessionInfo>("file_drop.session", {});
          if (!session || typeof session.token !== "string") throw new Error("文件中转站没有拿到访问令牌");
          state.token = session.token;
          state.chunkBytes = Number(session.chunkBytes) || state.chunkBytes;
          state.rootDir = String(session.rootDir ?? "");
          rootLine.textContent = state.rootDir ? `存放目录：${state.rootDir}` : "";
        };

        const loadFiles = async () => {
          const res = await api("/plugins/file-drop/files?limit=1000");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as { files?: FileEntry[] };
          state.files = Array.isArray(body.files) ? body.files : [];
          // prune selected ids that no longer exist
          const ids = new Set(state.files.map(f => f.id));
          for (const id of [...state.selected]) {
            if (!ids.has(id)) state.selected.delete(id);
          }
        };

        const refresh = async () => {
          if (state.busy) return;
          state.busy = true;
          refreshBtn.disabled = true;
          state.error = "";
          try {
            if (!state.token) await loadSession();
            await loadFiles();
          } catch (error) {
            state.error = `文件列表加载失败：${errText(error)}`;
          } finally {
            state.loading = false;
            state.busy = false;
            refreshBtn.disabled = false;
            renderFiles();
          }
        };

        // ---------- upload ----------
        const uploadOne = async (file: File) => {
          const item: UploadItem = {
            id: `${file.name}:${file.size}:${Math.random().toString(36).slice(2, 8)}`,
            file,
            name: file.name,
            size: file.size,
            sent: 0,
            phase: "uploading",
            error: "",
          };
          state.queue.set(item.id, item);
          renderQueue();
          try {
            const beginRes = await api("/plugins/file-drop/upload/begin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: file.name, size: file.size }),
            });
            if (!beginRes.ok) {
              const detail = (await beginRes.json().catch(() => ({}))) as { error?: string };
              throw new Error(detail.error ?? `开始上传失败（HTTP ${beginRes.status}）`);
            }
            const begin = (await beginRes.json()) as { uploadId: string; chunkBytes?: number };
            const chunk = Number(begin.chunkBytes) || state.chunkBytes;

            let offset = 0;
            while (offset < file.size) {
              const slice = file.slice(offset, Math.min(offset + chunk, file.size));
              const res = await api(`/plugins/file-drop/upload/${begin.uploadId}?offset=${offset}`, {
                method: "PUT",
                body: slice,
                headers: { "Content-Type": "application/octet-stream" },
              });
              if (!res.ok) {
                const detail = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(detail.error ?? `分片上传失败（HTTP ${res.status}）`);
              }
              offset += slice.size;
              item.sent = offset;
              renderQueue();
            }

            // Zero-byte files skip the loop entirely; that is still a valid upload.
            item.phase = "finalizing";
            if (item.size > 0) item.phase = "done";
            renderQueue();

            const completeRes = await api(`/plugins/file-drop/upload/${begin.uploadId}/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!completeRes.ok) {
              const detail = (await completeRes.json().catch(() => ({}))) as { error?: string };
              throw new Error(detail.error ?? `收尾失败（HTTP ${completeRes.status}）`);
            }
            const done = (await completeRes.json()) as { file?: FileEntry };
            item.phase = "done";
            item.sent = item.size;
            renderQueue();
            if (done.file) state.files.unshift(done.file);
            renderFiles();
            setTimeout(() => {
              state.queue.delete(item.id);
              renderQueue();
            }, 1400);
          } catch (error) {
            item.phase = "error";
            item.error = errText(error);
            renderQueue();
            // Do not silently accumulate failures in the queue; keep them visible.
          }
        };

        const uploadFiles = async (fileList: FileList | File[]) => {
          const files = [...fileList].filter((file) => file && typeof file.size === "number");
          if (files.length === 0) return;
          try {
            if (!state.token) await loadSession();
          } catch (error) {
            say(`暂时无法上传：${errText(error)}`);
            return;
          }
          for (const file of files) await uploadOne(file);
          if (state.queue.size > 0 && [...state.queue.values()].every((item) => item.phase === "done")) {
            state.queue.clear();
            renderQueue();
          }
        };

        // ---------- download ----------
        const startDownload = async (file: FileEntry) => {
          try {
            if (!state.token) await loadSession();
            const token = state.token;
            if (!token) throw new Error("没有下载令牌");
            const base = host.basePath && host.basePath !== "/" ? host.basePath.replace(/\/+$/, "") : "";
            const href = `${base}/plugins/file-drop/download/${file.id}?t=${encodeURIComponent(token)}`;
            const link = document.createElement("a");
            link.href = href;
            link.download = file.name;
            link.rel = "noopener";
            document.body.append(link);
            link.click();
            link.remove();
            say(`开始下载 ${file.name}`);
          } catch (error) {
            say(`下载失败：${errText(error)}`);
          }
        };

        // ---------- mkdir ----------
        const toggleMkdir = () => {
          mkdirRow.classList.toggle("fd-show");
          if (mkdirRow.classList.contains("fd-show")) {
            mkdirInput.focus();
          }
        };

        const doMkdir = async () => {
          const name = mkdirInput.value.trim();
          if (!name) { say("请输入目录名称"); return; }
          mkdirConfirmBtn.disabled = true;
          try {
            const res = await api("/plugins/file-drop/mkdir", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; name?: string };
            if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
            say(`已创建目录 ${body.name ?? name}`);
            mkdirRow.classList.remove("fd-show");
            mkdirInput.value = "";
            await refresh();
          } catch (error) {
            say(`创建目录失败：${errText(error)}`);
          } finally {
            mkdirConfirmBtn.disabled = false;
          }
        };

        // ---------- batch delete ----------
        const doBatchDelete = async () => {
          if (state.selected.size === 0) return;
          const items = [...state.selected].map(id => {
            const entry = state.files.find(f => f.id === id);
            return { name: entry?.name ?? "" };
          }).filter(i => i.name);
          if (items.length === 0) return;
          if (!confirm(`确认删除 ${items.length} 项？此操作不可恢复。`)) return;
          deleteAllBtn.disabled = true;
          try {
            const res = await api("/plugins/file-drop/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items }),
            });
            if (!res.ok) {
              const detail = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(detail.error ?? `HTTP ${res.status}`);
            }
            const body = (await res.json()) as { ok: boolean; results?: Array<{ name: string; ok: boolean; error?: string }> };
            const failed = (body.results ?? []).filter(r => !r.ok);
            if (failed.length > 0) {
              say(`部分删除失败：${failed.map(r => r.name + " (" + (r.error ?? "?") + ")").join("、")}`);
            } else {
              say(`已删除 ${items.length} 项`);
            }
            state.selected.clear();
            await refresh();
          } catch (error) {
            say(`批量删除失败：${errText(error)}`);
          } finally {
            deleteAllBtn.disabled = false;
          }
        };

        // ---------- events ----------
        fileInput.onchange = () => {
          // Snapshot first: `fileInput.files` is a live FileList, and clearing
          // `value` empties it. Reading it afterwards uploads nothing.
          const picked = fileInput.files ? [...fileInput.files] : [];
          fileInput.value = "";
          void uploadFiles(picked);
        };
        drop.addEventListener("dragover", (event) => {
          event.preventDefault();
          drop.classList.add("fd-over");
        });
        drop.addEventListener("dragleave", () => drop.classList.remove("fd-over"));
        drop.addEventListener("drop", (event) => {
          event.preventDefault();
          drop.classList.remove("fd-over");
          if (event.dataTransfer?.files?.length) void uploadFiles(event.dataTransfer.files);
        });
        // Prevent the whole page from navigating when a drop misses the zone.
        const swallow = (event: Event) => event.preventDefault();
        page.addEventListener("dragover", swallow);
        page.addEventListener("drop", swallow);

        let searchTimer = 0;
        search.oninput = () => {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(() => {
            state.search = search.value;
            renderFiles();
          }, 120);
        };
        refreshBtn.onclick = () => void refresh();

        // show mkdir button only when we have a rootDir (session loaded)
        const observer = new MutationObserver(() => {
          if (state.rootDir) mkdirBtn.style.display = "";
        });
        observer.observe(rootLine, { childList: true, characterData: true });

        mkdirBtn.onclick = toggleMkdir;
        mkdirConfirmBtn.onclick = doMkdir;
        mkdirCancelBtn.onclick = () => {
          mkdirRow.classList.remove("fd-show");
          mkdirInput.value = "";
        };
        mkdirInput.onkeydown = (e) => {
          if (e.key === "Enter") doMkdir();
          if (e.key === "Escape") { mkdirRow.classList.remove("fd-show"); mkdirInput.value = ""; }
        };
        deleteAllBtn.onclick = doBatchDelete;
        cancelSelectBtn.onclick = () => {
          state.selected.clear();
          renderFiles();
        };

        renderFiles();
        void refresh();

        return {
          dispose: () => {
            observer.disconnect();
            clearTimeout(toastTimer);
            clearTimeout(searchTimer);
            requestAbort.abort();
            page.remove();
            toast.remove();
          },
        };
      },
    });
  },
});

function filterFiles(files: FileEntry[], needle: string): FileEntry[] {
  if (!needle) return files;
  return files.filter((file) => String(file.name ?? "").toLowerCase().includes(needle));
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path (insecure origin, permission denied) */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

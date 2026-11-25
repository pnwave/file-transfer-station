# 文件中转站（File Drop）

往这台机器的**真实文件夹**里传**任意格式、任意大小**的文件，随时下载回来，或者复制它的绝对路径。

专门解决聊天输入框搞不定的情况：

- 超过附件上限的文件（几个 G 的磁盘镜像、模型权重、原始视频）。
- 需要一个**文件系统路径**才能用的东西 —— `ffmpeg`、`scp`、模型加载器、Agent 的 `exec`。
- 从手机、平板、局域网里另一台电脑传过来的文件。

## 你会得到什么

- Control UI 侧边栏多一个**文件中转站**页面：
  - 拖拽或选择文件上传，逐文件实时进度
  - 可搜索的文件列表（**目录单独成行**，带 📁 图标）
  - **多选 + 批量下载**（勾选多个文件，一键依次下载）
  - 新建目录（`mkdir`）
  - 逐条下载 / 复制绝对路径 / 删除（支持多选批量删除）
  - 统计信息：目录占用、磁盘余量、进行中的上传
- Gateway 这台机器上的一个真实目录。默认 `~/.openclaw/file-drop`，可用 `rootDir` 改。
- 一个 `file_drop_list` 工具，助手能直接查到你刚传的文件的绝对路径，不用你手打。

## 安装

### 方式一：从 GitHub 安装（推荐，最方便）

本仓库即是插件源码：[pnwave/file-transfer-station](https://github.com/pnwave/file-transfer-station)

```sh
# 任意一台 OpenClaw 机器上
openclaw plugins install https://github.com/pnwave/file-transfer-station
```

装完在 Control UI 侧边栏即可看到**文件中转站**，无需额外配置。

### 方式二：官方 tgz 包安装

`npm pack` 生成的 tgz 即官方安装包：

```sh
openclaw plugins install npm-pack:/path/to/openclaw-plugin-file-drop-1.0.0.tgz --force
```

- `npm-pack:` 走 OpenClaw 管理的按插件独立 npm 工程，依赖解析、入口指向按官方包路径校验。
- 需要交互确认能力（capability）时加 `--accept-capabilities`。
- 更新版本：重新 `npm pack`，再 `openclaw plugins update file-drop`（或重新 `install npm-pack:新.tgz --force`）。

### 方式三：本机目录直装 / 源码链接（开发用）

```sh
# 同机开发
openclaw plugins install . --force

# 或直接挂源码目录
openclaw plugins install --link <本目录> --force
```

改了代码要重新生效：

```sh
node scripts/build-ui.mjs && openclaw plugins install . --force
```

## 为什么多大都能传

Gateway 的 Node HTTP 服务器有请求超时，一次性丢几个 G 的请求体会传到一半断掉。所以上传是分片的：

1. `POST /plugins/file-drop/upload/begin` —— 服务端按精确大小预分配一个稀疏分片文件，返回 `uploadId`。
2. `PUT /plugins/file-drop/upload/<id>?offset=<n>` —— 每个请求一个分片（默认 16 MB）。任意偏移可先写，重试即断点续传。
3. `POST /plugins/file-drop/upload/<id>/complete` —— 校验最终大小，可选校验 SHA-256，然后把分片文件改名落盘。

下载走磁盘流式传输并支持 `Content-Range`，断线可以接着下。

## 安全边界

- 上传根目录是唯一可写区域。所有路径在 `resolve()` 之后校验，文件名会清洗，存储名不会互相覆盖。
- HTTP 路由用 `auth: "plugin"`：Gateway 不拦，由插件通过已认证的 RPC（`file_drop.session`，`operator.read` scope）签发自己的 12 小时 HMAC 令牌。Gateway 的 bearer token 永远不会出现在 URL 里。
- `.token-secret` 和 `.index.json` 放在上传根目录内，权限 `0600`。

## 配置

```json5
{
  plugins: {
    entries: {
      "file-drop": {
        enabled: true,
        config: {
          rootDir: "/mnt/bigdisk/drop", // 可选，必须是绝对路径
          chunkMb: 32,                  // 可选，1–256，默认 16
          maxFileGb: 0,                 // 可选，0 表示不限
        },
      },
    },
  },
}
```

## 接口速查

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/plugins/file-drop/upload/begin` | 开始上传，返回 `uploadId` |
| PUT | `/plugins/file-drop/upload/<id>?offset=<n>` | 写入一个分片 |
| POST | `/plugins/file-drop/upload/<id>/complete` | 校验并落盘 |
| POST | `/plugins/file-drop/upload/<id>/abort` | 放弃这次上传 |
| GET | `/plugins/file-drop/files?search=&limit=` | 文件列表（目录与文件合并，含 `type` 字段） |
| GET | `/plugins/file-drop/download/<id>?t=<token>` | 下载，支持 `Range` |
| POST | `/plugins/file-drop/delete` | 删除，支持 `{"ids":[...]}` 多选 |
| POST | `/plugins/file-drop/mkdir` | 新建目录 `{"name":"..."}` |
| GET | `/plugins/file-drop/stats` | 目录、磁盘余量、进行中的上传 |

除下载可以用 `?t=<token>` 外，其余接口都要 `Authorization: Bearer <token>`；令牌由 RPC `file_drop.session` 签发。

## 排障

- **上传卡住不动、但文件已经写满**：旧版曾用 `stream.pipeline(req, ...)` 写分片，pipeline 收尾时会销毁请求流，响应发不出去。现在改成手动遍历请求体写入，不会再出现。
- **页面没出现**：确认 `openclaw plugins inspect file-drop` 里 `status` 是 `loaded`，且 `openclaw.plugin.json#controlUi.entry` 指向真实存在的 `dist/control-ui/<hash>/index.js`。
- **浏览器下载变成 0 KB 空文件**：Gateway 默认自签证书没有 SAN，Chrome 的「不安全下载」策略会拦截不安全源头的 attachment。解决：换用带 SAN 的证书，或在浏览器里允许该站点的下载。

# 文件中转站（File Drop）

往这台机器的**真实文件夹**里传**任意格式、任意大小**的文件，随时下载回来，或者复制它的绝对路径。

专门解决聊天输入框搞不定的情况：

- 超过附件上限的文件（几个 G 的磁盘镜像、模型权重、原始视频）。
- 需要一个**文件系统路径**才能用的东西 —— `ffmpeg`、`scp`、模型加载器、Agent 的 `exec`。
- 从手机、平板、局域网里另一台电脑传过来的文件。

## 你会得到什么

- Control UI 侧边栏多一个**文件中转站**页面：拖拽或选择文件、逐文件实时进度、可搜索的文件列表，一键下载 / 复制路径 / 删除。
- Gateway 这台机器上的一个真实目录。默认 `~/.openclaw/file-drop`，可用 `rootDir` 改。
- 一个 `file_drop_list` 工具，助手能直接查到你刚传的文件的绝对路径，不用你手打。

## 安装

### 方式一：本机目录直装（同一台机器开发/测试）

```sh
cd <本目录>
openclaw plugins install . --force
```

安装会通过正在运行的 Gateway 直接生效。之后在 Control UI 侧边栏打开**文件中转站**。

改了代码要重新生效：

```sh
node scripts/build-ui.mjs && openclaw plugins install . --force
```

### 方式二：打官方包，装到任何一台 OpenClaw 机器（推荐）

本插件已按 OpenClaw 官方包结构封装（`package.json` + `openclaw.plugin.json` + 构建产物 `dist/`），
`releases/` 里的 `.tgz` 就是可直接安装的官方包：

```sh
# 在任意一台 OpenClaw 机器上（把 tgz 拷过去，或用 scp 拉过来）
openclaw plugins install npm-pack:/path/to/openclaw-plugin-file-drop-1.0.0.tgz --force
```

- `npm-pack:` 走的是 OpenClaw 管理的按插件独立 npm 工程，依赖解析、入口指向都已按官方包路径校验过。
- 需要交互确认能力（capability）时加 `--accept-capabilities`。
- 装完在 Control UI 侧边栏即可看到**文件中转站**，无需额外配置。
- 更新版本：重新 `npm pack`，再对同一 id 执行 `openclaw plugins update file-drop`（或重新 `install npm-pack:新.tgz --force`）。

### 方式三：`--link` 源码链接装（不想复制、直接挂源码目录）

```sh
openclaw plugins install --link <本目录> --force
```

改动源码后 `openclaw plugins reload file-drop` 即可。

## 为什么多大都能传

Gateway 的 Node HTTP 服务器有请求超时，一次性丢几个 G 的请求体会传到一半断掉。所以上传是分片的：

1. `POST /plugins/file-drop/upload/begin` —— 服务端按精确大小预分配一个稀疏分片文件，返回 `uploadId`。
2. `PUT /plugins/file-drop/upload/<id>?offset=<n>` —— 每个请求一个分片（默认 16 MB）。任意偏移可以先写，所以重试是断点续传，不是从头再来。
3. `POST /plugins/file-drop/upload/<id>/complete` —— 校验最终大小，可选校验 SHA-256，然后把分片文件改名落盘。

下载走磁盘流式传输并支持 `Content-Range`，断线可以接着下。

## 安全边界

- 上传根目录是唯一可写区域。所有路径在 `resolve()` 之后校验，文件名会清洗，存储名不会互相覆盖。
- HTTP 路由用 `auth: "plugin"`：Gateway 不拦，由插件通过已认证的 RPC（`file_drop.session`，`operator.write`）签发自己的 12 小时 HMAC 令牌。Gateway 的 bearer token 永远不会出现在 URL 里。
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
| GET | `/plugins/file-drop/files?search=&limit=` | 文件列表（含绝对路径） |
| GET | `/plugins/file-drop/download/<id>?t=<token>` | 下载，支持 `Range` |
| POST | `/plugins/file-drop/delete` | 删除 |
| GET | `/plugins/file-drop/stats` | 目录、磁盘余量、进行中的上传 |

除下载可以用 `?t=<token>` 外，其余接口都要 `Authorization: Bearer <token>`；令牌由 RPC `file_drop.session` 签发。

## 排障

- **上传卡住不动、但文件已经写满**：旧版曾用 `stream.pipeline(req, ...)` 写分片，pipeline 收尾时会销毁请求流，响应发不出去。现在改成手动遍历请求体写入，不会再出现。
- **页面没出现**：确认 `openclaw plugins inspect file-drop` 里 `status` 是 `loaded`，且 `openclaw.plugin.json#controlUi.entry` 指向真实存在的 `dist/control-ui/<hash>/index.js`。
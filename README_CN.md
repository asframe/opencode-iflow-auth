# OpenCode iFlow 认证插件

[![npm version](https://img.shields.io/npm/v/@asframe/opencode-iflow-auth)](https://www.npmjs.com/package/@asframe/opencode-iflow-auth)
[![npm downloads](https://img.shields.io/npm/dm/@asframe/opencode-iflow-auth)](https://www.npmjs.com/package/@asframe/opencode-iflow-auth)
[![license](https://img.shields.io/npm/l/@asframe/opencode-iflow-auth)](https://www.npmjs.com/package/@asframe/opencode-iflow-auth)
[![GitHub](https://img.shields.io/badge/GitHub-asframe%2Fopencode--iflow--auth-blue)](https://github.com/asframe/opencode-iflow-auth)

OpenCode 插件，用于 iFlow.cn，支持 Qwen、DeepSeek、Kimi、GLM 和 iFlow ROME 模型，提供双重认证和 CLI 代理支持。

## 功能特性

- **双重认证**：支持 OAuth 2.0 (PKCE) 和 API Key 认证。
- **CLI 代理模式**：通过 iflow CLI 支持 GLM-5，自动启动代理服务器。
- **多账号轮换**：支持粘性和轮询策略。
- **自动令牌刷新**：速率限制处理，支持指数退避。
- **原生思考模式**：支持 GLM-4.x、GLM-5 和 DeepSeek R1 模型。
- **可配置超时**：请求超时和迭代限制，防止挂起。
- **自动端口选择**：OAuth 回调服务器端口冲突自动避免。
- **自动安装 CLI**：如果未安装 iflow CLI，可自动安装。

## 支持的模型

### API Key 模式 (`iflow` provider)

通过 OAuth 2.0 或 API Key 认证可用的模型：

| 模型 | 上下文 | 输出 | 描述 |
|-------|---------|--------|-------------|
| `deepseek-v3` | 128K | 32K | DeepSeek V3 |
| `deepseek-v3.2` | 128K | 64K | DeepSeek V3.2 |
| `deepseek-r1` | 128K | 32K | DeepSeek R1 (思考模式) |
| `glm-4.6` | 200K | 128K | GLM-4.6 (推理, 视觉) |
| `glm-4.7` | 256K | 64K | GLM-4.7 (最新, 推理, 视觉) |
| `qwen3-max` | 256K | 32K | Qwen3 Max |
| `qwen3-max-preview` | 256K | 32K | Qwen3 Max 预览版 |
| `qwen3-coder-plus` | 1M | 64K | Qwen3 Coder Plus |
| `qwen3-vl-plus` | 256K | 32K | Qwen3 VL Plus (视觉) |
| `qwen3-32b` | 128K | 32K | Qwen3 32B |
| `qwen3-235b` | 256K | 64K | Qwen3 235B |
| `qwen3-235b-a22b-thinking-2507` | 256K | 64K | Qwen3 235B 思考模式 |
| `qwen3-235b-a22b-instruct` | 256K | 64K | Qwen3 235B 指令版 |
| `kimi-k2` | 128K | 64K | Kimi K2 |
| `kimi-k2-0905` | 256K | 64K | Kimi K2 0905 |
| `iflow-rome-30ba3b` | 256K | 64K | iFlow ROME 30B |

### CLI 代理模式 (`iflow-proxy` provider)

**包含 API Key 模式的所有模型**，外加以下独占模型：

| 模型 | 上下文 | 输出 | 描述 |
|-------|---------|--------|-------------|
| `glm-5` | 256K | 64K | GLM-5 - 旗舰模型 (744B 参数, 40B 激活), 推理和编码最佳 |
| `glm-5-free` | 256K | 64K | GLM-5 免费版 - 与 glm-5 能力相同, 限时免费 |
| `glm-5-thinking` | 256K | 64K | GLM-5 思考版 - 增强"系统2"深度推理能力 |

**GLM-5 模型家族：**

| 模型 | 描述 |
|-------|-------------|
| `glm-5` | 智谱 AI 最新旗舰模型。744B 参数（40B 激活），28.5T tokens。推理、编码和代理任务最佳。 |
| `glm-5-free` | GLM-5 免费访问，促销期间免费。能力相同，无需付费。 |
| `glm-5-thinking` | 增强深度推理模式。擅长复杂架构问题和"系统2"思考。 |

**总结：**
- **API Key 模式**：16 个模型
- **CLI 代理模式**：19 个模型（16 + 3 个独占）

**注意**：如果你更喜欢 CLI 认证而非 API Key，CLI 代理模式也可用于任何模型。

## 两种插件模式

本包导出两个插件：

### 1. `IFlowPlugin` - 直接 API 模式

直接调用 iFlow.cn API 访问标准模型。

| 属性 | 值 |
|----------|-------|
| Provider | `iflow` |
| baseURL | `https://apis.iflow.cn/v1` |
| 认证 | OAuth 2.0 / API Key |

### 2. `IFlowProxyPlugin` - CLI 代理模式

通过 iflow CLI 路由请求以支持 GLM-5。OpenCode 加载插件时，代理服务器会自动启动。

| 属性 | 值 |
|----------|-------|
| Provider | `iflow-proxy` |
| 代理端口 | `127.0.0.1:19998` |
| 认证 | iflow CLI 登录 |

**工作原理：**
1. 插件检测模型是否需要 CLI（glm-5、glm-5-free、glm-5-thinking）
2. 在端口 19998 上启动本地代理服务器
3. 通过 stdin 将需要 CLI 的模型路由到 `iflow` CLI
4. 其他模型直接路由到 iFlow API

## 安装

### 快速开始

将插件添加到你的 `opencode.json` 或 `opencode.jsonc`：

```json
{
  "plugin": ["@asframe/opencode-iflow-auth"]
}
```

### 完整配置

```json
{
  "plugin": ["@asframe/opencode-iflow-auth"],
  "provider": {
    "iflow": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://apis.iflow.cn/v1"
      },
      "models": {
        "deepseek-v3.2": {
          "name": "DeepSeek V3.2",
          "limit": { "context": 128000, "output": 64000 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "glm-4.6": {
          "name": "GLM-4.6",
          "limit": { "context": 128000, "output": 64000 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "kimi-k2": {
          "name": "Kimi K2",
          "limit": { "context": 128000, "output": 64000 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "qwen3-coder-plus": {
          "name": "Qwen3 Coder Plus",
          "limit": { "context": 1000000, "output": 64000 },
          "modalities": { "input": ["text"], "output": ["text"] }
        }
      }
    },
    "iflow-proxy": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://127.0.0.1:19998/v1"
      },
      "models": {
        "glm-5": {
          "name": "GLM-5 (via CLI Proxy)",
          "limit": { "context": 256000, "output": 64000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        },
        "glm-5-free": {
          "name": "GLM-5 Free (via CLI Proxy)",
          "limit": { "context": 256000, "output": 64000 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "glm-5-thinking": {
          "name": "GLM-5 Thinking (via CLI Proxy)",
          "limit": { "context": 256000, "output": 64000 },
          "modalities": { "input": ["text"], "output": ["text"] }
        }
      }
    }
  }
}
```

## 设置

### 直接 API 模式

1. 运行 `opencode auth login`。
2. 选择 `Other`，输入 `iflow`，按回车。
3. 选择认证方式：
   - **OAuth 2.0**：跟随浏览器流程进行安全的令牌认证。
   - **API Key**：输入你的 iFlow API key（以 `sk-` 开头）。

### CLI 代理模式（用于 GLM-5）

1. 安装 iflow CLI：`npm install -g iflow-cli`
2. 登录 iflow CLI：`iflow login`
3. 使用 `iflow-proxy` provider 时，代理服务器会自动启动。

**自动安装 CLI：**

如果未安装 iflow CLI，插件可以自动为你安装。启用此功能需设置环境变量：

```bash
# PowerShell
$env:IFLOW_AUTO_INSTALL_CLI = "true"

# Bash
export IFLOW_AUTO_INSTALL_CLI=true
```

**CLI 代理要求：**
- Node.js 18+
- iflow CLI 已安装并登录（或设置 `IFLOW_AUTO_INSTALL_CLI=true` 自动安装）
- 端口 19998 可用（或使用已运行的代理）

## 使用

```bash
# 直接 API 模式
opencode run "你好" --model iflow/deepseek-v3.2
opencode run "你好" --model iflow/glm-4.6
opencode run "你好" --model iflow/kimi-k2

# CLI 代理模式 (GLM-5)
opencode run "你好" --model iflow-proxy/glm-5
opencode run "你好" --model iflow-proxy/glm-5-thinking
```

## 配置

编辑 `~/.config/opencode/iflow.json`：

```json
{
  "default_auth_method": "oauth",
  "account_selection_strategy": "round-robin",
  "auth_server_port_start": 8087,
  "auth_server_port_range": 10,
  "max_request_iterations": 50,
  "request_timeout_ms": 300000,
  "enable_log_api_request": false
}
```

### 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|--------|------|---------|-------------|
| `default_auth_method` | string | `oauth` | 默认认证方式 (`oauth`, `apikey`) |
| `account_selection_strategy` | string | `sticky` | 账号轮换策略 (`sticky`, `round-robin`) |
| `auth_server_port_start` | number | `8087` | OAuth 回调服务器起始端口 (1024-65535) |
| `auth_server_port_range` | number | `10` | 尝试的端口数量 (1-100) |
| `max_request_iterations` | number | `50` | 防止挂起的最大循环迭代次数 (10-1000) |
| `request_timeout_ms` | number | `300000` | 请求超时时间（毫秒）(60000-600000ms) |
| `enable_log_api_request` | boolean | `false` | 启用 API 请求/响应日志 |

### 环境变量

| 变量 | 描述 |
|----------|-------------|
| `IFLOW_AUTH_DEBUG` | 启用认证插件调试日志 (`true`/`false`) |
| `IFLOW_PROXY_DEBUG` | 启用代理插件调试日志 (`true`/`false`) |
| `IFLOW_AUTO_INSTALL_CLI` | 未安装时自动安装 iflow CLI（默认：`true`，设为 `false` 禁用） |
| `IFLOW_AUTO_LOGIN` | 未登录时自动触发 iflow 登录（默认：`true`，设为 `false` 禁用） |
| `IFLOW_DEFAULT_AUTH_METHOD` | 覆盖默认认证方式 |
| `IFLOW_ACCOUNT_SELECTION_STRATEGY` | 覆盖账号选择策略 |
| `IFLOW_AUTH_SERVER_PORT_START` | 覆盖 OAuth 服务器端口 |
| `IFLOW_AUTH_SERVER_PORT_RANGE` | 覆盖 OAuth 服务器端口范围 |
| `IFLOW_MAX_REQUEST_ITERATIONS` | 覆盖最大迭代次数 |
| `IFLOW_REQUEST_TIMEOUT_MS` | 覆盖请求超时时间 |
| `IFLOW_ENABLE_LOG_API_REQUEST` | 启用 API 日志 |

## 存储位置

**Linux/macOS:**
- 凭证：`~/.config/opencode/iflow-accounts.json`
- 插件配置：`~/.config/opencode/iflow.json`

**Windows:**
- 凭证：`%APPDATA%\opencode\iflow-accounts.json`
- 插件配置：`%APPDATA%\opencode\iflow.json`

## 思考模型

iFlow 支持思考模型，可通过 variants 自定义思考预算：

### GLM-4.6、GLM-5 和 DeepSeek R1

```json
{
  "variants": {
    "low": { "thinkingConfig": { "thinkingBudget": 1024 } },
    "medium": { "thinkingConfig": { "thinkingBudget": 8192 } },
    "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
  }
}
```

## 故障排除

### CLI 代理问题

如果遇到 CLI 代理问题：

1. **检查 iflow CLI 是否已安装：**
   ```bash
   iflow --version
   ```

2. **检查是否已登录：**
   ```bash
   iflow login
   ```

3. **直接测试 iflow CLI：**
   ```bash
   echo "你好" | iflow -m glm-5
   ```

4. **启用调试日志：**
   ```bash
   $env:IFLOW_PROXY_DEBUG = "true"
   opencode run "你好" --model iflow-proxy/glm-5
   ```

### 端口已被占用

如果端口 19998 已被占用，插件会检测并使用现有代理。如果需要重启代理：

```bash
# 终止端口 19998 上的进程
# Windows
Get-Process -Id (Get-NetTCPConnection -LocalPort 19998).OwningProcess | Stop-Process -Force

# Linux/macOS
lsof -i :19998 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### 认证问题

1. **API Key 不工作：**
   - 确保你的 API key 以 `sk-` 开头
   - 在 [iFlow.cn](https://iflow.cn) 检查 key 是否有效

2. **OAuth 不工作：**
   - 清除浏览器 cookies
   - 尝试其他浏览器
   - 检查回调端口是否可用

## 常见问题

### Q: 为什么 GLM-5 需要 CLI 代理？

GLM-5 需要特殊的认证方式，只有通过 iflow CLI 才能使用。CLI 代理模式通过将请求路由到 CLI 来解决这个问题。

### Q: 可以同时使用两种模式吗？

可以！你可以同时配置 `iflow` 和 `iflow-proxy` providers，并根据需要切换使用。

### Q: 这是官方插件吗？

不是，这是一个独立实现，不隶属于、不被认可、也不受 iFlow.cn 支持。

### Q: 如何获取 API key？

1. 访问 [iFlow.cn](https://iflow.cn)
2. 创建账号或登录
3. 进入 API 设置
4. 生成新的 API key

## 更新日志

### v1.0.6
- Thinking 模型配置与 iflow CLI 保持一致
- 使用正则表达式匹配模型
- 硬编码常量与 iflow 官方 CLI 保持一致

### v1.0.5
- 修复登录检测逻辑
- 直接读取 iflow CLI 配置文件

### v1.0.4
- 插件加载时自动启动代理服务
- 添加 CLI 状态 toast 提示

### v1.0.3
- 默认启用自动安装和自动登录

### v1.0.2
- 添加自动登录检测功能

### v1.0.1
- 添加 GLM-4.7 模型支持
- 改进 README 文档，更清晰的模型对比
- 添加详细的 GLM-5 模型家族描述
- 更新模型数量（16 个 API Key 模型，19 个 CLI 代理模型）

### v1.0.0
- 初始发布
- 双重认证（OAuth 2.0 / API Key）
- GLM-5 的 CLI 代理模式
- 自动安装 CLI 功能
- 多账号轮换
- 思考模型支持

## 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 许可证

MIT 许可证 - 详情见 [LICENSE](LICENSE)。

## 免责声明

本插件仅供学习和教育目的。这是一个独立实现，不隶属于、不被认可、也不受 iFlow.cn 支持。使用本插件的风险自负。

欢迎提交 PR 进一步优化本插件。

## 链接

- [GitHub 仓库](https://github.com/asframe/opencode-iflow-auth)
- [npm 包](https://www.npmjs.com/package/@asframe/opencode-iflow-auth)
- [iFlow.cn](https://iflow.cn)
- [OpenCode](https://opencode.ai)

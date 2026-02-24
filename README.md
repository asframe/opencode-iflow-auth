# OpenCode iFlow Auth Plugin

[![npm version](https://img.shields.io/npm/v/@asframe/opencode-iflow-auth)](https://www.npmjs.com/package/@asframe/opencode-iflow-auth)
[![npm downloads](https://img.shields.io/npm/dm/@asframe/opencode-iflow-auth)](https://www.npmjs.com/package/@asframe/opencode-iflow-auth)
[![license](https://img.shields.io/npm/l/@asframe/opencode-iflow-auth)](https://www.npmjs.com/package/@asframe/opencode-iflow-auth)
[![GitHub](https://img.shields.io/badge/GitHub-asframe%2Fopencode--iflow--auth-blue)](https://github.com/asframe/opencode-iflow-auth)

**[中文文档](README_CN.md)** | **English**

OpenCode plugin for iFlow.cn providing access to Qwen, DeepSeek, Kimi, GLM, and iFlow ROME models with dual authentication and CLI Proxy support.

## Features

- **Dual authentication**: OAuth 2.0 (PKCE) and API Key support.
- **CLI Proxy mode**: Support GLM-5 through iflow CLI with automatic proxy server.
- **Multi-account rotation**: Sticky and round-robin strategies.
- **Automated token refresh**: Rate limit handling with exponential backoff.
- **Native thinking mode**: Support for GLM-4.x, GLM-5 and DeepSeek R1 models.
- **Configurable timeout**: Request timeout and iteration limits to prevent hangs.
- **Automatic port selection**: OAuth callback server port conflict avoidance.
- **Auto-install CLI**: Automatically install iflow CLI if not found.

## Supported Models

### API Key Mode (`iflow` provider)

Models available via OAuth 2.0 or API Key authentication:

| Model | Context | Output | Description |
|-------|---------|--------|-------------|
| `deepseek-v3` | 128K | 32K | DeepSeek V3 |
| `deepseek-v3.2` | 128K | 64K | DeepSeek V3.2 |
| `deepseek-r1` | 128K | 32K | DeepSeek R1 (Thinking) |
| `glm-4.6` | 200K | 128K | GLM-4.6 (Reasoning, Vision) |
| `glm-4.7` | 256K | 64K | GLM-4.7 (Latest, Reasoning, Vision) |
| `qwen3-max` | 256K | 32K | Qwen3 Max |
| `qwen3-max-preview` | 256K | 32K | Qwen3 Max Preview |
| `qwen3-coder-plus` | 1M | 64K | Qwen3 Coder Plus |
| `qwen3-vl-plus` | 256K | 32K | Qwen3 VL Plus (Vision) |
| `qwen3-32b` | 128K | 32K | Qwen3 32B |
| `qwen3-235b` | 256K | 64K | Qwen3 235B |
| `qwen3-235b-a22b-thinking-2507` | 256K | 64K | Qwen3 235B Thinking |
| `qwen3-235b-a22b-instruct` | 256K | 64K | Qwen3 235B Instruct |
| `kimi-k2` | 128K | 64K | Kimi K2 |
| `kimi-k2-0905` | 256K | 64K | Kimi K2 0905 |
| `iflow-rome-30ba3b` | 256K | 64K | iFlow ROME 30B |

### CLI Proxy Mode (`iflow-proxy` provider)

**All models from API Key Mode** PLUS these exclusive models:

| Model | Context | Output | Description |
|-------|---------|--------|-------------|
| `glm-5` | 256K | 64K | GLM-5 - Flagship model (744B params, 40B active), best for reasoning & coding |
| `glm-5-free` | 256K | 64K | GLM-5 Free - Same capabilities as glm-5, free for limited time |
| `glm-5-thinking` | 256K | 64K | GLM-5 Thinking - Enhanced "System 2" deep reasoning capabilities |

**GLM-5 Model Family:**

| Model | Description |
|-------|-------------|
| `glm-5` | Latest flagship model from Zhipu AI. 744B parameters (40B active), 28.5T tokens. Best-in-class for reasoning, coding, and agentic tasks. |
| `glm-5-free` | Free access to GLM-5 during promotional period. Same capabilities, no cost. |
| `glm-5-thinking` | Enhanced deep reasoning mode. Excels at complex architectural problems and "System 2" thinking. |

**Summary:**
- **API Key Mode**: 16 models
- **CLI Proxy Mode**: 19 models (16 + 3 exclusive)

**Note**: CLI Proxy mode can also be used if you prefer CLI authentication over API Key for any model.

## Two Plugin Modes

This package exports two plugins:

### 1. `IFlowPlugin` - Direct API Mode

Direct API calls to iFlow.cn for standard models.

| Property | Value |
|----------|-------|
| Provider | `iflow` |
| baseURL | `https://apis.iflow.cn/v1` |
| Auth | OAuth 2.0 / API Key |

### 2. `IFlowProxyPlugin` - CLI Proxy Mode

Routes requests through iflow CLI for GLM-5 support. The proxy server starts automatically when OpenCode loads the plugin.

| Property | Value |
|----------|-------|
| Provider | `iflow-proxy` |
| Proxy Port | `127.0.0.1:19998` |
| Auth | iflow CLI login |

**How it works:**
1. Plugin detects if model requires CLI (glm-5, glm-5-free, glm-5-thinking)
2. Starts a local proxy server on port 19998
3. Routes CLI-required models through `iflow` CLI via stdin
4. Routes other models directly to iFlow API

## Installation

### Quick Start

Add the plugin to your `opencode.json` or `opencode.jsonc`:

```json
{
  "plugin": ["@asframe/opencode-iflow-auth"]
}
```

### Full Configuration

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

## Setup

### Direct API Mode

1. Run `opencode auth login`.
2. Select `Other`, type `iflow`, and press enter.
3. Choose authentication method:
   - **OAuth 2.0**: Follow browser flow for secure token-based authentication.
   - **API Key**: Enter your iFlow API key (starts with `sk-`).

### CLI Proxy Mode (for GLM-5)

1. Install iflow CLI: `npm install -g iflow-cli`
2. Login to iflow CLI: `iflow login`
3. The proxy server will start automatically when using `iflow-proxy` provider.

**Auto-install CLI:**

If iflow CLI is not installed, the plugin can automatically install it for you. Enable this feature by setting the environment variable:

```bash
# PowerShell
$env:IFLOW_AUTO_INSTALL_CLI = "true"

# Bash
export IFLOW_AUTO_INSTALL_CLI=true
```

**Requirements for CLI Proxy:**
- Node.js 18+
- iflow CLI installed and logged in (or set `IFLOW_AUTO_INSTALL_CLI=true` to auto-install)
- Port 19998 available (or will use existing proxy if already running)

## Usage

```bash
# Direct API mode
opencode run "你好" --model iflow/deepseek-v3.2
opencode run "你好" --model iflow/glm-4.6
opencode run "你好" --model iflow/kimi-k2

# CLI Proxy mode (GLM-5)
opencode run "你好" --model iflow-proxy/glm-5
opencode run "你好" --model iflow-proxy/glm-5-thinking
```

## Configuration

Edit `~/.config/opencode/iflow.json`:

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

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `default_auth_method` | string | `oauth` | Default authentication method (`oauth`, `apikey`) |
| `account_selection_strategy` | string | `sticky` | Account rotation strategy (`sticky`, `round-robin`) |
| `auth_server_port_start` | number | `8087` | Starting port for OAuth callback server (1024-65535) |
| `auth_server_port_range` | number | `10` | Number of ports to try (1-100) |
| `max_request_iterations` | number | `50` | Maximum loop iterations to prevent hangs (10-1000) |
| `request_timeout_ms` | number | `300000` | Request timeout in milliseconds (60000-600000ms) |
| `enable_log_api_request` | boolean | `false` | Enable API request/response logging |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `IFLOW_AUTH_DEBUG` | Enable debug logging for auth plugin (`true`/`false`) |
| `IFLOW_PROXY_DEBUG` | Enable debug logging for proxy plugin (`true`/`false`) |
| `IFLOW_AUTO_INSTALL_CLI` | Auto-install iflow CLI if not installed (default: `true`, set `false` to disable) |
| `IFLOW_AUTO_LOGIN` | Auto-trigger iflow login if not logged in (default: `true`, set `false` to disable) |
| `IFLOW_DEFAULT_AUTH_METHOD` | Override default auth method |
| `IFLOW_ACCOUNT_SELECTION_STRATEGY` | Override account selection strategy |
| `IFLOW_AUTH_SERVER_PORT_START` | Override OAuth server port |
| `IFLOW_AUTH_SERVER_PORT_RANGE` | Override OAuth server port range |
| `IFLOW_MAX_REQUEST_ITERATIONS` | Override max iterations |
| `IFLOW_REQUEST_TIMEOUT_MS` | Override request timeout |
| `IFLOW_ENABLE_LOG_API_REQUEST` | Enable API logging |

## Storage

**Linux/macOS:**
- Credentials: `~/.config/opencode/iflow-accounts.json`
- Plugin Config: `~/.config/opencode/iflow.json`

**Windows:**
- Credentials: `%APPDATA%\opencode\iflow-accounts.json`
- Plugin Config: `%APPDATA%\opencode\iflow.json`

## Thinking Models

iFlow supports thinking models with customizable thinking budgets via variants:

### GLM-4.6, GLM-5 & DeepSeek R1

```json
{
  "variants": {
    "low": { "thinkingConfig": { "thinkingBudget": 1024 } },
    "medium": { "thinkingConfig": { "thinkingBudget": 8192 } },
    "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
  }
}
```

## Troubleshooting

### CLI Proxy Issues

If you encounter issues with the CLI proxy:

1. **Check if iflow CLI is installed:**
   ```bash
   iflow --version
   ```

2. **Check if you're logged in:**
   ```bash
   iflow login
   ```

3. **Test iflow CLI directly:**
   ```bash
   echo "你好" | iflow -m glm-5
   ```

4. **Enable debug logging:**
   ```bash
   $env:IFLOW_PROXY_DEBUG = "true"
   opencode run "你好" --model iflow-proxy/glm-5
   ```

### Port Already in Use

If port 19998 is already in use, the plugin will detect it and use the existing proxy. If you need to restart the proxy:

```bash
# Kill existing process on port 19998
# Windows
Get-Process -Id (Get-NetTCPConnection -LocalPort 19998).OwningProcess | Stop-Process -Force

# Linux/macOS
lsof -i :19998 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Authentication Issues

1. **API Key not working:**
   - Ensure your API key starts with `sk-`
   - Check if the key is valid at [iFlow.cn](https://iflow.cn)

2. **OAuth not working:**
   - Clear browser cookies
   - Try a different browser
   - Check if the callback port is available

## FAQ

### Q: Why do I need CLI Proxy for GLM-5?

GLM-5 requires special authentication that is only available through the iflow CLI. The CLI Proxy mode bridges this gap by routing requests through the CLI.

### Q: Can I use both modes at the same time?

Yes! You can configure both `iflow` and `iflow-proxy` providers and use them interchangeably.

### Q: Is this plugin official?

No, this is an independent implementation and is not affiliated with, endorsed by, or supported by iFlow.cn.

### Q: How do I get an API key?

1. Visit [iFlow.cn](https://iflow.cn)
2. Create an account or login
3. Go to API settings
4. Generate a new API key

## Changelog

### v1.0.7
- Fixed CLI detection to avoid triggering interactive login
- Check config files instead of running `iflow --version`
- Disabled auto-login (iflow CLI is now interactive)

### v1.0.6
- Thinking model patterns aligned with iflow CLI
- Use regex patterns for model matching
- Hardcoded constants aligned with iflow official CLI

### v1.0.5
- Fixed login detection logic
- Read iflow CLI config file directly

### v1.0.4
- Auto-start proxy server on plugin load
- Added toast notifications for CLI status

### v1.0.3
- Default enable auto-install and auto-login

### v1.0.2
- Added auto-login detection feature

### v1.0.1
- Added GLM-4.7 model support
- Improved README documentation with clearer model comparison
- Added detailed GLM-5 model family description
- Updated model counts (16 API Key models, 19 CLI Proxy models)

### v1.0.0
- Initial release
- Dual authentication (OAuth 2.0 / API Key)
- CLI Proxy mode for GLM-5
- Auto-install CLI feature
- Multi-account rotation
- Thinking model support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This plugin is provided strictly for learning and educational purposes. It is an independent implementation and is not affiliated with, endorsed by, or supported by iFlow.cn. Use of this plugin is at your own risk.

Feel free to open a PR to optimize this plugin further.

## Links

- [GitHub Repository](https://github.com/asframe/opencode-iflow-auth)
- [npm Package](https://www.npmjs.com/package/@asframe/opencode-iflow-auth)
- [iFlow.cn](https://iflow.cn)
- [OpenCode](https://opencode.ai)

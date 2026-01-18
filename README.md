# OpenCode iFlow Auth Plugin

OpenCode authentication plugin for iFlow.cn, providing access to Claude, GPT, Gemini, DeepSeek, and Qwen models through a unified API.

## Features

- **Dual Authentication**: Support both OAuth 2.0 and API Key authentication
- **Multi-Account Support**: Add and manage multiple accounts with automatic rotation
- **Account Selection Strategies**: Sticky, round-robin, or lowest-usage
- **Automatic Token Refresh**: OAuth tokens are automatically refreshed when expired
- **Rate Limit Handling**: Automatic account switching on rate limits
- **Error Recovery**: Unhealthy accounts are automatically recovered
- **Token Counting**: Built-in token usage tracking with tiktoken
- **Thinking Models**: Special support for GLM-4.x thinking models

## Supported Models

- **iFlow ROME**: `iflow-rome-30ba3b` (256K conteK output)
- **Qwen3**: `qwen3-max`, `qwen3-coder-plus`, `qwen3-vl-plus`, `qwen3-235b-a22b-thinking-2507`, etc.
- **Kimi K2**: `kimi-k2`, `kimi-k2-0905`
- **GLM-4**: `glm-4.6`, `glm-4.7` (with thinking support)
- **DeepSeek**: `deepseek-v3`, `deepseek-v3.2`, `deepseek-r1`

## Installation

```bash
npm install @zhafron/opencode-iflow-auth
```

## Quick Start

### 1. Login with OAuth (Recommended)

```bash
opencode auth login
```

Choose OAuth when prompted, then follow the browser flow.

### 2. Login with API Key

```bash
opencode auth login
```

Choose API Key when prompted, then enter your iFlow API key rts with `sk-`).

### 3. Add Multiple Accounts

The plugin will prompt you to add more accounts after each successful authentication. You can add unlimited accounts for automatic rotation.

## Configuration

Create `~/.config/opencode/iflow-config.json`:

```json
{
  "default_auth_method": "oauth",
  "account_selection_strategy": "lowest-usage",
  "auth_server_port_start": 8087,
  "auth_server_port_range": 10,
  "max_request_iterations": 50,
  "request_timeout_ms": 300000,
  "enable_usage_tracking": false,
  "enable_debug_logging": false
}
```

### Configuration Options

- `default_auth_method`: `"oauth"` or `"apikey"` (default: `"oauth"`)
- `account_selection_strategy`: `"sticky"`, `"round-robin"`, or `"lowest-usage"` (default: `"lowest-usage"`)
- `auth_server_port_start`: Starting port for OAuth callback server (default: `8087`)
- `auth_server_port_range`: Number of ports to try (default: `10`)
- `max_request_iterations`: Maximum retry iterations (default: `50`)
- `request_timeout_ms`: Request timeout in milliseconds (default: `300000`)
- `enable_usage_tracking`: Enable token usage tracking (default: `false`)
- `enable_debug_logging`: Enable debug logs (default: `false`)

## Usage Examples

### Basic Chat

```typescript
// The plugin handles authentication automatically
// Just use OpenCode normally with iFlow models
```

### Using Thinking Models

```typescript
// GLM-4.x models automatically enable thinking mode
// Use glm-4.6 or glm-4.7 for reasoning tasks
```

### Vision Models

```typescript
// Use qwen3-vl-plus for vision tasks
// Images are automatically processed
```

## Account Management

### View Accounts

```bash
cat ~/.config/opencode/iflow-accounts.json
```

### Remove All Accounts

```bash
rm ~/.config/opencode/iflow-accounts.json
rm ~/.config/opencode/iflow-usage.json
```

### Fresh Start

When logging in, choose "fresh start" to replace all existing accounts.

## Authentication Methods

### OAuth 2.0

**Pros:**
- More secure (tokens can be revoked)
- Automatic token refresh
- Better for long-term use

**Cons:**
- Requires browser access
- More complex setup

### API Key

**Pros:**
- Simple and fast
- Works in headless environments
- No browser required

**Cons:**
- Less secure (keys don't expire)
- Manual key management

## Troubleshooting

### OAuth Flow Fails

1. Check if port 8087-8096 are available
2. Try different port range in config
3. Check firewall settings

### API Key Invalid

1. Verify key starts with `sk-`
2. Check key hasn't been revoked
3. Test key with: `curl -H "Authorization: Bearer YOUR_KEY" https://apis.iflow.cn/v1/models`

### Rate Limits

The plugin automatically switches accounts when rate limited. Add more accounts for better throughput.

### Token Refresh Fails

OAuth tokens are automatically refreshed. If refresh fails repeatedly, re-login with `opencode auth login`.

## Development

### Build

```bash
npm run build
```

### Format

```bash
npm run format
```

### Type Check

```bash
npm run typecheck
```

## Architecture

```
src/
├── constants.ts          # iFlow constants and model definitions
├── index.ts             # Plugin exports
├── plugin.ts            # Main plugin implementation
├── iflow/
│   ├── oauth.ts         # OAuth 2.0 flow (PKCE)
│   └── apikey.ts        # API key validation
└── plugin/
    ├── accounts.ts      # Account management
    ├── cli.ts           # CLI prompts
    ├── config/          # Configuration system
    ├── errors.ts        # Error types
    ├── logger.ts        # Logging
    ├── models.ts        # Model utilities
    ├── server.ts        # OAuth callback server
    ├── storage.ts       # Persistent storage
    ├── token.ts         # Token refresh
    ├── types.ts         # TypeScript types
    └── usage.ts         # Token counting (tiktoken)
```

## License

MIT

## Author

tickernelz

## Links

- [GitHub](https://github.com/tickernelz/opencode-iflow-auth)
- [npm](https://www.npmjs.com/package/@zhafron/opencode-iflow-auth)
- [iFlow.cn](https://iflow.cn)

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { loadConfig } from "./plugin/config/index.js"
import { AccountManager, generateAccountId } from "./plugin/accounts.js"
import { authorizeIFlowOAuth, exchangeOAuthCode } from "./iflow/oauth.js"
import { validateApiKey } from "./iflow/apikey.js"
import { startOAuthServer } from "./plugin/server.js"
import { startProxy, getProxyInstance } from "./iflow/proxy.js"
import { getModels, refreshModelsCache, type ModelCache } from "./iflow/models.js"
import {
  promptApiKey,
  promptEmail,
} from "./plugin/cli.js"
import { isHeadlessEnvironment } from "./plugin/headless.js"
import type { ManagedAccount } from "./plugin/types.js"
import { IFLOW_CONSTANTS, registerAllModels, requiresCLI } from "./constants.js"

const DEBUG = process.env.IFLOW_AUTH_DEBUG === 'true'

function log(...args: any[]) {
  if (DEBUG) {
    console.error('[iflow-auth]', ...args)
  }
}

const openBrowser = (url: string) => {
  if (isHeadlessEnvironment()) {
    return
  }
  const platform = process.platform
  if (platform === "win32") {
    import("node:child_process").then(({ exec }) => {
      exec(`cmd /c start "" "${url}"`)
    })
  }
}

function parseCallbackInput(input: string): string {
  if (input.startsWith('http')) {
    try {
      const url = new URL(input)
      const code = url.searchParams.get('code')
      if (code) return code
    } catch {}
  }
  
  if (input.includes('code=')) {
    const match = input.match(/code=([^&\s]+)/)
    if (match && match[1]) return match[1]
  }
  
  return input
}

let proxyStarted = false
let modelCache: ModelCache | null = null

async function ensureProxyStarted(): Promise<string> {
  if (!proxyStarted) {
    log('Starting CLI proxy...')
    const proxy = await startProxy()
    proxyStarted = true
    log('CLI proxy started at:', proxy.getBaseUrl())
    return proxy.getBaseUrl()
  }
  return getProxyInstance().getBaseUrl()
}

// 智能插件：自动路由到正确的 API 端点
export const IFlowPlugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadConfig()
  const showToast = (
    message: string,
    variant: "info" | "warning" | "success" | "error",
  ) => {
    input.client.tui.showToast({ body: { message, variant } }).catch(() => {})
  }

  // 在插件初始化时启动代理服务器
  try {
    await ensureProxyStarted()
    log('Proxy server started successfully')
  } catch (e) {
    log('Failed to start proxy server:', e)
  }

  return {
    auth: {
      provider: "iflow",
      loader: async (getAuth: () => Promise<any>, provider: any) => {
        log('loader called')
        
        // 确保代理服务器已启动
        await ensureProxyStarted()
        
        const auth = await getAuth()
        log('auth result:', auth ? 'found' : 'not found')
        
        const am = await AccountManager.loadFromDisk(
          config.account_selection_strategy,
        )

        log('account count:', am.getAccountCount())

        // 获取账户用于获取模型列表
        const account = am.getCurrentOrNext()
        
        // 尝试获取动态模型列表
        if (account?.apiKey) {
          try {
            modelCache = await getModels(account.apiKey)
            log('Loaded models from API:', modelCache.models.length)
          } catch (e) {
            log('Failed to load models from API:', e)
          }
        }

        // 注册所有模型（包括 CLI 独占模型）
        registerAllModels(provider, modelCache, true)

        const proxy = getProxyInstance()
        
        // 检查 CLI 状态
        if (!proxy.isCLIAvailable()) {
          log('CLI not available')
          showToast('iflow CLI is not available. GLM-5 models will not work. Install: npm install -g iflow-cli', 'warning')
        } else if (!proxy.isCLILoggedIn()) {
          log('CLI not logged in')
          showToast('iflow CLI is not logged in. GLM-5 models will not work. Run: iflow login', 'warning')
        }

        const accountCount = am.getAccountCount()
        if (accountCount === 0) {
          log('No accounts found')
          // 如果有 CLI 登录，允许使用 CLI 认证
          if (proxy.isCLIAvailable() && proxy.isCLILoggedIn()) {
            return {
              apiKey: 'cli-auth',
              baseURL: getProxyInstance().getBaseUrl(),
            }
          }
          return {}
        }

        const firstAccount = am.getCurrentOrNext()
        if (!firstAccount) {
          log('No available account')
          return {}
        }

        log('Using account:', firstAccount.email, 'apiKey:', firstAccount.apiKey.substring(0, 10) + '...')

        // 使用代理服务器作为 baseURL，代理会自动路由到正确的 API
        // 代理服务器会根据模型类型自动选择：
        // - GLM-5 系列走 CLI
        // - 其他模型直接转发到 iFlow API
        return {
          apiKey: firstAccount.apiKey,
          baseURL: getProxyInstance().getBaseUrl(),
        }
      },
      methods: [
        {
          label: "iFlow OAuth 2.0",
          type: "oauth",
          authorize: async (inputs?: any) =>
            new Promise(async (resolve) => {
              try {
                const authData = await authorizeIFlowOAuth(
                  config.auth_server_port_start,
                )
                
                const headless = isHeadlessEnvironment()
                
                if (headless) {
                  resolve({
                    url: authData.authUrl,
                    instructions: `Headless mode: Open this URL in your browser:\n${authData.authUrl}\n\nAfter authorization, paste the callback URL or code here.`,
                    method: "code",
                    callback: async (codeInput: string) => {
                      try {
                        const code = parseCallbackInput(codeInput)
                        const res = await exchangeOAuthCode(code, authData.redirectUri)
                        const am = await AccountManager.loadFromDisk(
                          config.account_selection_strategy,
                        )
                        const acc: ManagedAccount = {
                          id: generateAccountId(),
                          email: res.email,
                          authMethod: "oauth",
                          refreshToken: res.refreshToken,
                          accessToken: res.accessToken,
                          expiresAt: res.expiresAt,
                          apiKey: res.apiKey,
                          rateLimitResetTime: 0,
                          isHealthy: true,
                        }
                        am.addAccount(acc)
                        await am.saveToDisk()
                        
                        // 刷新模型缓存
                        try {
                          modelCache = await refreshModelsCache(res.apiKey)
                        } catch {}
                        
                        showToast(`Successfully logged in as ${res.email}`, "success")
                        return { type: "success" as const, key: res.apiKey }
                      } catch (e: any) {
                        showToast(`Login failed: ${e.message}`, "error")
                        return { type: "failed" as const }
                      }
                    },
                  })
                } else {
                  const { url, waitForAuth } = await startOAuthServer(
                    authData.authUrl,
                    authData.state,
                    authData.redirectUri,
                    config.auth_server_port_start,
                    config.auth_server_port_range,
                  )
                  openBrowser(url)
                  resolve({
                    url,
                    instructions: `Open this URL to continue: ${url}`,
                    method: "auto",
                    callback: async () => {
                      try {
                        const res = await waitForAuth()
                        const am = await AccountManager.loadFromDisk(
                          config.account_selection_strategy,
                        )
                        const acc: ManagedAccount = {
                          id: generateAccountId(),
                          email: res.email,
                          authMethod: "oauth",
                          refreshToken: res.refreshToken,
                          accessToken: res.accessToken,
                          expiresAt: res.expiresAt,
                          apiKey: res.apiKey,
                          rateLimitResetTime: 0,
                          isHealthy: true,
                        }
                        am.addAccount(acc)
                        await am.saveToDisk()
                        
                        // 刷新模型缓存
                        try {
                          modelCache = await refreshModelsCache(res.apiKey)
                        } catch {}
                        
                        showToast(`Successfully logged in as ${res.email}`, "success")
                        return { type: "success" as const, key: res.apiKey }
                      } catch (e: any) {
                        showToast(`Login failed: ${e.message}`, "error")
                        return { type: "failed" as const }
                      }
                    },
                  })
                }
              } catch (e: any) {
                resolve({
                  url: "",
                  instructions: "Authorization failed",
                  method: "auto",
                  callback: async () => ({ type: "failed" as const }),
                })
              }
            }),
        },
        {
          label: "iFlow API Key",
          type: "api",
          authorize: async (inputs?: any) => {
            if (!inputs) {
              return { type: "failed" as const }
            }

            const apiKey = await promptApiKey()
            if (!apiKey) {
              return { type: "failed" as const }
            }

            try {
              const result = await validateApiKey(apiKey)
              const email = await promptEmail()
              const am = await AccountManager.loadFromDisk(
                config.account_selection_strategy,
              )
              const acc: ManagedAccount = {
                id: generateAccountId(),
                email,
                authMethod: "apikey",
                apiKey,
                rateLimitResetTime: 0,
                isHealthy: true,
              }
              am.addAccount(acc)
              await am.saveToDisk()
              
              // 刷新模型缓存
              try {
                modelCache = await refreshModelsCache(apiKey)
              } catch {}
              
              return { type: "success" as const, key: apiKey }
            } catch (error: any) {
              return { type: "failed" as const }
            }
          },
        },
      ],
    },
    "chat.headers": async (
      input: any,
      output: { headers: Record<string, string> },
    ) => {
      output.headers["User-Agent"] = `${IFLOW_CONSTANTS.USER_AGENT}/2.0`
    },
  }
}

// 保留 IFlowProxyPlugin 作为别名，保持向后兼容
export const IFlowProxyPlugin = IFlowPlugin

// 导出类型
export type { IFlowConfig } from './plugin/config/index.js'
export type { IFlowAuthMethod, ManagedAccount } from './plugin/types.js'
export type { ModelCache, IFlowModelInfo } from './iflow/models.js'

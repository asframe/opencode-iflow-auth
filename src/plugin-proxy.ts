import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { loadConfig } from "./plugin/config/index.js"
import { AccountManager, generateAccountId } from "./plugin/accounts.js"
import { authorizeIFlowOAuth, exchangeOAuthCode } from "./iflow/oauth.js"
import { validateApiKey } from "./iflow/apikey.js"
import { startOAuthServer } from "./plugin/server.js"
import { startProxy, getProxyInstance } from "./iflow/proxy.js"
import {
  promptApiKey,
  promptEmail,
} from "./plugin/cli.js"
import { isHeadlessEnvironment } from "./plugin/headless.js"
import type { ManagedAccount } from "./plugin/types.js"
import { IFLOW_CONSTANTS, registerIFlowModels } from "./constants.js"

const DEBUG = process.env.IFLOW_PROXY_DEBUG === 'true'

const AUTO_START_PROXY = process.env.IFLOW_AUTO_START_PROXY !== 'false'

function log(...args: any[]) {
  if (DEBUG) {
    console.error('[iflow-proxy]', ...args)
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

async function ensureProxyStarted(): Promise<string> {
  if (!proxyStarted) {
    if (AUTO_START_PROXY) {
      log('Starting CLI proxy...')
      const proxy = await startProxy()
      proxyStarted = true
      log('CLI proxy started at:', proxy.getBaseUrl())
      return proxy.getBaseUrl()
    }
  }
  return getProxyInstance().getBaseUrl()
}

export const IFlowProxyPlugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadConfig()
  const showToast = (
    message: string,
    variant: "info" | "warning" | "success" | "error",
  ) => {
    input.client.tui.showToast({ body: { message, variant } }).catch(() => {})
  }

  await ensureProxyStarted()

  return {
    auth: {
      provider: "iflow-proxy",
      loader: async (getAuth: () => Promise<any>, provider: any) => {
        log('loader called')
        
        const auth = await getAuth()
        log('auth result:', auth ? 'found' : 'not found')
        
        const am = await AccountManager.loadFromDisk(
          config.account_selection_strategy,
        )

        log('account count:', am.getAccountCount())

        registerIFlowModels(provider)

        const proxyUrl = getProxyInstance().getBaseUrl()
        const proxy = getProxyInstance()
        
        if (!proxy.isCLIAvailable()) {
          log('CLI not available, returning error')
          showToast('iflow CLI is not available. Please install: npm install -g iflow-cli', 'error')
          return {}
        }

        if (!proxy.isCLILoggedIn()) {
          log('CLI not logged in, returning error')
          showToast('iflow CLI is not logged in. Please run: iflow login', 'error')
          return {}
        }

        const accountCount = am.getAccountCount()
        if (accountCount === 0) {
          log('No accounts found, using CLI auth directly')
          return {
            apiKey: 'cli-auth',
            baseURL: proxyUrl,
          }
        }

        const firstAccount = am.getCurrentOrNext()
        if (!firstAccount) {
          log('No available account')
          return {
            apiKey: 'cli-auth',
            baseURL: proxyUrl,
          }
        }

        log('Using account:', firstAccount.email, 'apiKey:', firstAccount.apiKey.substring(0, 10) + '...')

        return {
          apiKey: firstAccount.apiKey,
          baseURL: proxyUrl,
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
              await validateApiKey(apiKey)
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

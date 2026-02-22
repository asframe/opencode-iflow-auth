import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { loadConfig } from "./plugin/config/index.js"
import { AccountManager, generateAccountId } from "./plugin/accounts.js"
import { authorizeIFlowOAuth } from "./iflow/oauth.js"
import { validateApiKey } from "./iflow/apikey.js"
import { startOAuthServer } from "./plugin/server.js"
import {
  promptApiKey,
  promptEmail,
} from "./plugin/cli.js"
import type { ManagedAccount } from "./plugin/types.js"
import { IFLOW_CONSTANTS, registerIFlowModels } from "./constants.js"

const DEBUG = process.env.IFLOW_AUTH_DEBUG === 'true'

function log(...args: any[]) {
  if (DEBUG) {
    console.error('[iflow-auth]', ...args)
  }
}

const openBrowser = (url: string) => {
  const platform = process.platform
  if (platform === "win32") {
    import("node:child_process").then(({ exec }) => {
      exec(`cmd /c start "" "${url}"`)
    })
  }
}

export const IFlowPlugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadConfig()
  const showToast = (
    message: string,
    variant: "info" | "warning" | "success" | "error",
  ) => {
    input.client.tui.showToast({ body: { message, variant } }).catch(() => {})
  }

  return {
    auth: {
      provider: "iflow",
      loader: async (getAuth: () => Promise<any>, provider: any) => {
        log('loader called')
        
        const auth = await getAuth()
        log('auth result:', auth ? 'found' : 'not found')
        
        const am = await AccountManager.loadFromDisk(
          config.account_selection_strategy,
        )

        log('account count:', am.getAccountCount())

        registerIFlowModels(provider)

        const accountCount = am.getAccountCount()
        if (accountCount === 0) {
          log('No accounts found in loader')
          return {}
        }

        const firstAccount = am.getCurrentOrNext()
        if (!firstAccount) {
          log('No available account')
          return {}
        }

        log('Using account:', firstAccount.email, 'apiKey:', firstAccount.apiKey.substring(0, 10) + '...')

        return {
          apiKey: firstAccount.apiKey,
          baseURL: IFLOW_CONSTANTS.BASE_URL,
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
                      return { type: "success", key: res.apiKey }
                    } catch (e: any) {
                      showToast(`Login failed: ${e.message}`, "error")
                      return { type: "failed" }
                    }
                  },
                })
              } catch (e: any) {
                resolve({
                  url: "",
                  instructions: "Authorization failed",
                  method: "auto",
                  callback: async () => ({ type: "failed" }),
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

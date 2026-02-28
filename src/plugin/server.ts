import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import type { IFlowOAuthTokenResult } from '../iflow/oauth.js'
import { exchangeOAuthCode } from '../iflow/oauth.js'
import { isHeadlessEnvironment, promptOAuthCallback } from './headless.js'

export interface OAuthServerResult {
  url: string
  redirectUri: string
  waitForAuth: () => Promise<IFlowOAuthTokenResult>
}

function parseCallbackInput(input: string): { code: string; state: string } | null {
  try {
    if (input.startsWith('http')) {
      const url = new URL(input)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      if (code && state) {
        return { code, state }
      }
    }
    
    if (input.includes('code=')) {
      const codeMatch = input.match(/code=([^&\s]+)/)
      const stateMatch = input.match(/state=([^&\s]+)/)
      if (codeMatch && stateMatch && codeMatch[1] && stateMatch[1]) {
        return { code: codeMatch[1], state: stateMatch[1] }
      }
    }
    
    const parts = input.split(/\s+/).filter(p => p.length > 0)
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { code: parts[0], state: parts[1] }
    }
    if (parts.length === 1 && parts[0] && parts[0].length > 20) {
      return { code: parts[0], state: '' }
    }
    
    return null
  } catch {
    return null
  }
}

export async function startOAuthServer(
  authUrl: string,
  state: string,
  redirectUri: string,
  portStart: number,
  portRange: number
): Promise<OAuthServerResult> {
  let resolveAuth: (result: IFlowOAuthTokenResult) => void
  let rejectAuth: (error: Error) => void
  let timeoutHandle: NodeJS.Timeout

  const authPromise = new Promise<IFlowOAuthTokenResult>((resolve, reject) => {
    resolveAuth = resolve
    rejectAuth = reject
  })

  let server: ReturnType<typeof createServer> | null = null
  let actualPort = portStart

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '', `http://localhost:${actualPort}`)

    if (url.pathname === '/oauth2callback') {
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<html><body><h1>Authorization failed: ${error}</h1></body></html>`)
        clearTimeout(timeoutHandle)
        rejectAuth(new Error(`Authorization failed: ${error}`))
        setTimeout(() => server?.close(), 1000)
        return
      }

      if (!code || !returnedState) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<html><body><h1>Error: Missing code or state</h1></body></html>')
        clearTimeout(timeoutHandle)
        rejectAuth(new Error('Missing code or state in callback'))
        setTimeout(() => server?.close(), 1000)
        return
      }

      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<html><body><h1>Error: State mismatch</h1></body></html>')
        clearTimeout(timeoutHandle)
        rejectAuth(new Error('State mismatch'))
        setTimeout(() => server?.close(), 1000)
        return
      }

      try {
        const result = await exchangeOAuthCode(code, redirectUri)

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          `<html><body><h1>Authentication successful!</h1><p>Account: ${result.email}</p><p>You can close this window.</p></body></html>`
        )

        clearTimeout(timeoutHandle)
        setTimeout(() => {
          resolveAuth(result)
          setTimeout(() => server?.close(), 1000)
        }, 100)
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<html><body><h1>Error: ${error.message}</h1></body></html>`)
        clearTimeout(timeoutHandle)
        rejectAuth(error)
        setTimeout(() => server?.close(), 1000)
      }
    } else {
      res.writeHead(204)
      res.end()
    }
  }

  const headless = isHeadlessEnvironment()

  if (headless) {
    const manualAuth = async () => {
      const input = await promptOAuthCallback()
      const parsed = parseCallbackInput(input)
      
      if (!parsed || !parsed.code) {
        throw new Error('Invalid callback input. Please paste the full callback URL or authorization code.')
      }

      if (parsed.state && parsed.state !== state) {
        throw new Error('State mismatch. Please try again.')
      }

      return exchangeOAuthCode(parsed.code, redirectUri)
    }

    return {
      url: authUrl,
      redirectUri,
      waitForAuth: manualAuth
    }
  }

  for (let port = portStart; port < portStart + portRange; port++) {
    try {
      server = createServer(handler)
      await new Promise<void>((resolve, reject) => {
        server!.listen(port, '0.0.0.0', () => {
          actualPort = port
          resolve()
        })
        server!.on('error', reject)
      })
      break
    } catch (error: any) {
      if (error.code !== 'EADDRINUSE' || port === portStart + portRange - 1) {
        throw error
      }
    }
  }

  if (!server) {
    throw new Error('Failed to start OAuth callback server')
  }

  timeoutHandle = setTimeout(
    () => {
      if (server?.listening) {
        rejectAuth(new Error('OAuth timeout: No response after 10 minutes'))
        server.close()
      }
    },
    10 * 60 * 1000
  )

  return {
    url: authUrl,
    redirectUri,
    waitForAuth: () => authPromise
  }
}

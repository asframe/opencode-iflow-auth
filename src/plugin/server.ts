import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { IFLOW_CONSTANTS } from '../constants'
import type { IFlowOAuthTokenResult } from '../iflow/oauth'
import { exchangeOAuthCode } from '../iflow/oauth'

export interface OAuthServerResult {
  url: string
  waitForAuth: () => Promise<IFlowOAuthTokenResult>
}

export async function startOAuthServer(
  authUrl: string,
  state: string,
  codeVerifier: string,
  portStart: number = IFLOW_CONSTANTS.CALLBACK_PORT_START,
  portRange: number = IFLOW_CONSTANTS.CALLBACK_PORT_RANGE
): Promise<OAuthServerResult> {
  let resolveAuth: (result: IFlowOAuthTokenResult) => void
  let rejectAuth: (error: Error) => void

  const authPromise = new Promise<IFlowOAuthTokenResult>((resolve, reject) => {
    resolveAuth = resolve
    rejectAuth = reject
  })

  let server: ReturnType<typeof createServer> | null = null
  let actualPort = portStart

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '', `http://localhost:${actualPort}`)

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')

      if (!code || !returnedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<html><body><h1>Error: Missing code or state</h1></body></html>')
        rejectAuth(new Error('Missing code or state in callback'))
        server?.close()
        return
      }

      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<html><body><h1>Error: State mismatch</h1></body></html>')
        rejectAuth(new Error('State mismatch'))
        server?.close()
        return
      }

      try {
        const result = await exchangeOAuthCode(code, codeVerifier)

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h1>Authentication successful!</h1><p>You can close this window.</p></body></html>'
        )

        resolveAuth(result)
        server?.close()
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end(`<html><body><h1>Error: ${error.message}</h1></body></html>`)
        rejectAuth(error)
        server?.close()
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' })
      res.end('<html><body><h1>Not Found</h1></body></html>')
    }
  }

  for (let port = portStart; port < portStart + portRange; port++) {
    try {
      server = createServer(handler)
      await new Promise<void>((resolve, reject) => {
        server!.listen(port, () => {
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

  return {
    url: authUrl,
    waitForAuth: () => authPromise
  }
}

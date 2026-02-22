import { IFLOW_CONSTANTS } from '../constants.js'
import { randomBytes } from 'node:crypto'

export interface IFlowOAuthAuthorization {
  authUrl: string
  state: string
  redirectUri: string
}

export interface IFlowOAuthTokenResult {
  accessToken: string
  refreshToken: string
  expiresAt: number
  apiKey: string
  email: string
  authMethod: 'oauth'
}

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generateState(): string {
  return base64URLEncode(randomBytes(16))
}

export async function authorizeIFlowOAuth(port: number): Promise<IFlowOAuthAuthorization> {
  const state = generateState()
  const redirectUri = `http://localhost:${port}/oauth2callback`

  const params = new URLSearchParams({
    loginMethod: 'phone',
    type: 'phone',
    redirect: redirectUri,
    state,
    client_id: IFLOW_CONSTANTS.CLIENT_ID
  })

  const authUrl = `${IFLOW_CONSTANTS.OAUTH_AUTHORIZE_URL}?${params.toString()}`

  return { authUrl, state, redirectUri }
}

export async function exchangeOAuthCode(
  code: string,
  redirectUri: string
): Promise<IFlowOAuthTokenResult> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: IFLOW_CONSTANTS.CLIENT_ID,
    client_secret: IFLOW_CONSTANTS.CLIENT_SECRET
  })

  const basicAuth = Buffer.from(
    `${IFLOW_CONSTANTS.CLIENT_ID}:${IFLOW_CONSTANTS.CLIENT_SECRET}`
  ).toString('base64')

  const response = await fetch(IFLOW_CONSTANTS.OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`
    },
    body: params.toString()
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  const userInfo = await fetchUserInfo(data.access_token)

  const expiresIn = data.expires_in || 3600
  const expiresAt = Date.now() + expiresIn * 1000

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    apiKey: userInfo.apiKey,
    email: userInfo.email,
    authMethod: 'oauth'
  }
}

export async function refreshOAuthToken(refreshToken: string): Promise<IFlowOAuthTokenResult> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: IFLOW_CONSTANTS.CLIENT_ID,
    client_secret: IFLOW_CONSTANTS.CLIENT_SECRET
  })

  const basicAuth = Buffer.from(
    `${IFLOW_CONSTANTS.CLIENT_ID}:${IFLOW_CONSTANTS.CLIENT_SECRET}`
  ).toString('base64')

  const response = await fetch(IFLOW_CONSTANTS.OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`
    },
    body: params.toString()
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  const userInfo = await fetchUserInfo(data.access_token)

  const expiresIn = data.expires_in || 3600
  const expiresAt = Date.now() + expiresIn * 1000

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
    apiKey: userInfo.apiKey,
    email: userInfo.email,
    authMethod: 'oauth'
  }
}

export async function fetchUserInfo(
  accessToken: string
): Promise<{ apiKey: string; email: string }> {
  const response = await fetch(
    `${IFLOW_CONSTANTS.USER_INFO_URL}?accessToken=${encodeURIComponent(accessToken)}`,
    {
      headers: {
        Accept: 'application/json'
      }
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`User info fetch failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  if (!data.success || !data.data) {
    throw new Error('User info request not successful')
  }

  if (!data.data.apiKey) {
    throw new Error('Missing apiKey in user info response')
  }

  const email = data.data.email || data.data.phone || 'oauth-user'

  return {
    apiKey: data.data.apiKey,
    email
  }
}

import { IFLOW_CONSTANTS } from '../constants'
import { randomBytes, createHash } from 'node:crypto'

export interface IFlowOAuthAuthorization {
  authUrl: string
  state: string
  codeVerifier: string
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

function generateCodeVerifier(): string {
  return base64URLEncode(randomBytes(32))
}

function generateCodeChallenge(verifier: string): string {
  return base64URLEncode(createHash('sha256').update(verifier).digest())
}

export async function authorizeIFlowOAuth(): Promise<IFlowOAuthAuthorization> {
  const state = base64URLEncode(randomBytes(16))
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  const params = new URLSearchParams({
    client_id: IFLOW_CONSTANTS.CLIENT_ID,
    response_type: 'code',
    redirect_uri: `http://localhost:${IFLOW_CONSTANTS.CALLBACK_PORT_START}/callback`,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })

  const authUrl = `${IFLOW_CONSTANTS.OAUTH_AUTHORIZE_URL}?${params.toString()}`

  return { authUrl, state, codeVerifier }
}

export async function exchangeOAuthCode(
  code: string,
  codeVerifier: string
): Promise<IFlowOAuthTokenResult> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `http://localhost:${IFLOW_CONSTANTS.CALLBACK_PORT_START}/callback`,
    client_id: IFLOW_CONSTANTS.CLIENT_ID,
    client_secret: IFLOW_CONSTANTS.CLIENT_SECRET,
    code_verifier: codeVerifier
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
  const response = await fetch(IFLOW_CONSTANTS.USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`User info fetch failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  return {
    apiKey: data.apiKey || data.api_key || '',
    email: data.email || data.username || 'oauth-user'
  }
}

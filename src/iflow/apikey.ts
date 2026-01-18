import { IFLOW_CONSTANTS } from '../constants'

export interface IFlowApiKeyResult {
  apiKey: string
  email: string
  authMethod: 'apikey'
}

export async function validateApiKey(apiKey: string): Promise<IFlowApiKeyResult> {
  const response = await fetch(`${IFLOW_CONSTANTS.BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': IFLOW_CONSTANTS.USER_AGENT
    }
  })

  if (!response.ok) {
    throw new Error(`API key validation failed: ${response.status}`)
  }

  return {
    apiKey,
    email: 'api-key-user',
    authMethod: 'apikey'
  }
}

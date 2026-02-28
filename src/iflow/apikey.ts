import { IFLOW_CONSTANTS } from '../constants.js'
import { fetchModelsFromAPI, type IFlowModelInfo } from './models.js'

export interface IFlowApiKeyResult {
  apiKey: string
  email: string
  authMethod: 'apikey'
  models?: IFlowModelInfo[]
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

  // 尝试解析模型列表
  let models: IFlowModelInfo[] | undefined
  try {
    const data = await response.json()
    if (data.object === 'list' && Array.isArray(data.data)) {
      models = data.data as IFlowModelInfo[]
    } else if (Array.isArray(data)) {
      models = data as IFlowModelInfo[]
    }
  } catch {
    // 忽略解析错误
  }

  return {
    apiKey,
    email: 'api-key-user',
    authMethod: 'apikey',
    models
  }
}

// 验证 API Key 并获取模型列表
export async function validateApiKeyAndGetModels(apiKey: string): Promise<IFlowApiKeyResult> {
  return validateApiKey(apiKey)
}

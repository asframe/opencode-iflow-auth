import { 
  requiresCLI, 
  isThinkingModel, 
  inferModelConfig, 
  type MergedModelConfig,
  type ModelCache,
  getAllAvailableModels
} from './iflow/models.js'

// 重新导出 requiresCLI 供其他模块使用
export { requiresCLI, isThinkingModel }

export type IFlowAuthMethod = 'oauth' | 'apikey'

export function isValidAuthMethod(method: string): method is IFlowAuthMethod {
  return method === 'oauth' || method === 'apikey'
}

export const IFLOW_CONSTANTS = {
  BASE_URL: 'https://apis.iflow.cn/v1',
  PROXY_URL: 'http://127.0.0.1:19998/v1',
  OAUTH_TOKEN_URL: 'https://iflow.cn/oauth/token',
  OAUTH_AUTHORIZE_URL: 'https://iflow.cn/oauth',
  USER_INFO_URL: 'https://iflow.cn/api/oauth/getUserInfo',
  SUCCESS_REDIRECT: 'https://iflow.cn/oauth/success',
  CLIENT_ID: '10009311001',
  CLIENT_SECRET: '4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW',
  AXIOS_TIMEOUT: 120000,
  USER_AGENT: 'OpenCode-iFlow',
  CALLBACK_PORT_START: 8087,
  CALLBACK_PORT_RANGE: 10
}

export const THINKING_MODEL_PATTERNS = [
  /^glm-5/,
  /^glm-4\.7/,
  /^glm-4\.6/,
  /^glm-4/,
  /deepseek/,
  /thinking/,
  /reasoning/,
  /^kimi-k2\.5/,
  /^o1-/
]

export function applyThinkingConfig(body: any, model: string): any {
  const thinkingBudget = body.providerOptions?.thinkingConfig?.thinkingBudget
  const isThinkingEnabled = body.providerOptions?.thinkingConfig?.enabled !== false

  if (model.startsWith('glm-5')) {
    const result: any = {
      ...body,
      temperature: 1,
      top_p: 0.95,
    }
    
    if (isThinkingEnabled) {
      result.chat_template_kwargs = { enable_thinking: true }
      result.enable_thinking = true
      result.thinking = { type: 'enabled' }
      if (thinkingBudget) {
        result.thinking_budget = thinkingBudget
      }
    } else {
      result.chat_template_kwargs = { enable_thinking: false }
      result.enable_thinking = false
      result.thinking = { type: 'disabled' }
    }
    
    return result
  }

  if (model.startsWith('glm-4')) {
    const result: any = {
      ...body,
      chat_template_kwargs: {
        enable_thinking: true,
        clear_thinking: false
      }
    }
    if (thinkingBudget) {
      result.thinking_budget = thinkingBudget
    }
    return result
  }

  if (model.startsWith('deepseek-r1')) {
    const result: any = { ...body }
    if (thinkingBudget) {
      result.thinking_budget = thinkingBudget
    }
    return result
  }

  return body
}

export interface IFlowModelConfig {
  id: string
  name: string
  context: number
  output: number
  inputModalities: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
  outputModalities: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
  reasoning?: boolean
  toolcall?: boolean
  temperature?: boolean
  family?: string
  variants?: Record<string, Record<string, any>>
  requiresCLI?: boolean
}

// 静态模型配置（作为后备和 CLI 独占模型）
export const IFLOW_MODELS: IFlowModelConfig[] = [
  {
    id: 'glm-5',
    name: 'GLM-5',
    context: 256000,
    output: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'glm',
    requiresCLI: true,
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'glm-5-free',
    name: 'GLM-5 Free',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'glm',
    requiresCLI: true,
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'glm-5-thinking',
    name: 'GLM-5 Thinking',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'glm',
    requiresCLI: true,
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'glm-4.6',
    name: 'GLM-4.6 Thinking',
    context: 200000,
    output: 128000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'glm',
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'qwen3-max',
    name: 'Qwen3 Max',
    context: 256000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'qwen3-max-preview',
    name: 'Qwen3 Max Preview',
    context: 256000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    context: 1000000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3-coder'
  },
  {
    id: 'qwen3-vl-plus',
    name: 'Qwen3 VL Plus',
    context: 256000,
    output: 32000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    family: 'qwen3-vl'
  },
  {
    id: 'qwen3-32b',
    name: 'Qwen3 32B',
    context: 128000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'qwen3-235b',
    name: 'Qwen3 235B',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'qwen3-235b-a22b-thinking-2507',
    name: 'Qwen3 235B Thinking',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'qwen3-thinking',
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'qwen3-235b-a22b-instruct',
    name: 'Qwen3 235B Instruct',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'kimi-k2',
    name: 'Kimi K2',
    context: 128000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'kimi'
  },
  {
    id: 'kimi-k2-0905',
    name: 'Kimi K2 0905',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'kimi'
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    context: 128000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'deepseek'
  },
  {
    id: 'deepseek-v3.2',
    name: 'DeepSeek V3.2',
    context: 128000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'deepseek'
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    context: 128000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'deepseek-r',
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'iflow-rome-30ba3b',
    name: 'iFlow ROME 30B',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    family: 'iflow-rome'
  }
]

// 将模型配置转换为 provider 模型格式
function modelConfigToProviderModel(modelConfig: IFlowModelConfig, useProxy: boolean): any {
  const needsCLI = modelConfig.requiresCLI || requiresCLI(modelConfig.id)
  const baseUrl = (useProxy && needsCLI) ? IFLOW_CONSTANTS.PROXY_URL : IFLOW_CONSTANTS.BASE_URL
  
  return {
    id: modelConfig.id,
    providerID: useProxy ? 'iflow-proxy' : 'iflow',
    api: {
      id: modelConfig.id,
      url: baseUrl,
      npm: '@ai-sdk/openai-compatible'
    },
    name: modelConfig.name,
    family: modelConfig.family || modelConfig.id.split('-')[0],
    capabilities: {
      temperature: modelConfig.temperature ?? true,
      reasoning: modelConfig.reasoning ?? false,
      attachment: modelConfig.inputModalities.includes('image'),
      toolcall: modelConfig.toolcall ?? false,
      input: {
        text: modelConfig.inputModalities.includes('text'),
        audio: modelConfig.inputModalities.includes('audio'),
        image: modelConfig.inputModalities.includes('image'),
        video: modelConfig.inputModalities.includes('video'),
        pdf: modelConfig.inputModalities.includes('pdf')
      },
      output: {
        text: modelConfig.outputModalities.includes('text'),
        audio: modelConfig.outputModalities.includes('audio'),
        image: modelConfig.outputModalities.includes('image'),
        video: modelConfig.outputModalities.includes('video'),
        pdf: modelConfig.outputModalities.includes('pdf')
      },
      interleaved: modelConfig.reasoning ?? false
    },
    cost: {
      input: 0,
      output: 0,
      cache: { read: 0, write: 0 }
    },
    limit: {
      context: modelConfig.context,
      output: modelConfig.output
    },
    status: 'active',
    options: {},
    headers: {},
    release_date: '2025-01-01',
    variants: modelConfig.variants || {}
  }
}

// 注册静态模型（原有函数，保持向后兼容）
export function registerIFlowModels(provider: any): void {
  for (const modelConfig of IFLOW_MODELS) {
    if (!provider.models[modelConfig.id]) {
      provider.models[modelConfig.id] = modelConfigToProviderModel(modelConfig, false)
    }
  }
}

// 注册动态模型（从 API 获取）
export function registerDynamicModels(provider: any, modelCache: ModelCache | null, useProxy: boolean = false): void {
  // 如果有动态模型缓存，优先使用
  if (modelCache && modelCache.models.length > 0) {
    const allModelIds = getAllAvailableModels(modelCache)
    
    for (const modelId of allModelIds) {
      if (!provider.models[modelId]) {
        // 查找静态配置
        const staticConfig = IFLOW_MODELS.find(m => m.id === modelId)
        
        if (staticConfig) {
          provider.models[modelId] = modelConfigToProviderModel(staticConfig, useProxy)
        } else {
          // 动态推断配置
          const inferredConfig = inferModelConfig(modelId)
          const config: IFlowModelConfig = {
            id: inferredConfig.id,
            name: inferredConfig.name,
            context: inferredConfig.context,
            output: inferredConfig.output,
            inputModalities: inferredConfig.inputModalities,
            outputModalities: inferredConfig.outputModalities,
            reasoning: inferredConfig.reasoning,
            toolcall: inferredConfig.toolcall,
            temperature: inferredConfig.temperature,
            family: inferredConfig.family,
            requiresCLI: inferredConfig.requiresCLI
          }
          provider.models[modelId] = modelConfigToProviderModel(config, useProxy)
        }
      }
    }
  } else {
    // 没有缓存时使用静态配置
    for (const modelConfig of IFLOW_MODELS) {
      if (!provider.models[modelConfig.id]) {
        provider.models[modelConfig.id] = modelConfigToProviderModel(modelConfig, useProxy)
      }
    }
  }
}

// 注册所有模型（静态 + 动态）
export function registerAllModels(provider: any, modelCache: ModelCache | null = null, useProxy: boolean = false): void {
  registerDynamicModels(provider, modelCache, useProxy)
}

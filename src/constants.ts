export type IFlowAuthMethod = 'oauth' | 'apikey'

export function isValidAuthMethod(method: string): method is IFlowAuthMethod {
  return method === 'oauth' || method === 'apikey'
}

export const IFLOW_CONSTANTS = {
  BASE_URL: 'https://apis.iflow.cn/v1',
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

export function isThinkingModel(model: string): boolean {
  return THINKING_MODEL_PATTERNS.some(pattern => pattern.test(model))
}

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
}

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

export function registerIFlowModels(provider: any): void {
  for (const modelConfig of IFLOW_MODELS) {
    const actualApiId = modelConfig.id
    if (!provider.models[modelConfig.id]) {
      provider.models[modelConfig.id] = {
        id: modelConfig.id,
        providerID: 'iflow',
        api: {
          id: actualApiId,
          url: IFLOW_CONSTANTS.BASE_URL,
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
  }
}

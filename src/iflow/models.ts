import { IFLOW_CONSTANTS } from '../constants.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

// iFlow 模型信息接口
export interface IFlowModelInfo {
  id: string
  object: string
  created: number
  owned_by: string
  permission?: any[]
  root?: string
  parent?: string
}

// 模型缓存接口
export interface ModelCache {
  version: 1
  lastUpdated: number
  models: IFlowModelInfo[]
  cliModels: string[]
}

// CLI 独占模型列表（这些模型只能通过 CLI 访问）
export const CLI_EXCLUSIVE_MODELS = ['glm-5', 'glm-5-free', 'glm-5-thinking']

// 需要特殊处理的模型模式
export const CLI_REQUIRED_PATTERNS = [/^glm-5/]

// Thinking 模型模式
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

// 获取缓存目录
function getCacheDir(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'opencode')
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, 'opencode')
}

// 获取模型缓存路径
export function getModelCachePath(): string {
  return join(getCacheDir(), 'iflow-models-cache.json')
}

// 默认模型缓存（当 API 不可用时使用）
const DEFAULT_MODELS_CACHE: ModelCache = {
  version: 1,
  lastUpdated: 0,
  models: [],
  cliModels: CLI_EXCLUSIVE_MODELS
}

// 从文件加载缓存
function loadCacheFromFile(): ModelCache {
  const path = getModelCachePath()
  try {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8')
      const cache = JSON.parse(content) as ModelCache
      if (cache.version === 1 && Array.isArray(cache.models)) {
        return cache
      }
    }
  } catch (error) {
    // 忽略错误，返回默认缓存
  }
  return { ...DEFAULT_MODELS_CACHE }
}

// 保存缓存到文件
function saveCacheToFile(cache: ModelCache): void {
  const path = getModelCachePath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(cache, null, 2), 'utf-8')
  } catch (error) {
    console.error('[iflow-models] Failed to save cache:', error)
  }
}

// 判断模型是否需要 CLI
export function requiresCLI(modelId: string): boolean {
  return CLI_REQUIRED_PATTERNS.some(pattern => pattern.test(modelId))
}

// 判断是否是 Thinking 模型
export function isThinkingModel(modelId: string): boolean {
  return THINKING_MODEL_PATTERNS.some(pattern => pattern.test(modelId))
}

// 从 iFlow API 获取模型列表
export async function fetchModelsFromAPI(apiKey: string): Promise<IFlowModelInfo[]> {
  const response = await fetch(`${IFLOW_CONSTANTS.BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': IFLOW_CONSTANTS.USER_AGENT
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`)
  }

  const data = await response.json()
  
  // OpenAI 兼容格式: { object: 'list', data: [...] }
  if (data.object === 'list' && Array.isArray(data.data)) {
    return data.data as IFlowModelInfo[]
  }
  
  // 直接返回数组
  if (Array.isArray(data)) {
    return data as IFlowModelInfo[]
  }

  return []
}

// 获取模型列表（带缓存）
export async function getModels(apiKey: string, forceRefresh = false): Promise<ModelCache> {
  const cache = loadCacheFromFile()
  const now = Date.now()
  const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 小时缓存

  // 如果缓存有效且不强制刷新，直接返回缓存
  if (!forceRefresh && cache.models.length > 0 && (now - cache.lastUpdated) < CACHE_TTL) {
    return cache
  }

  try {
    const models = await fetchModelsFromAPI(apiKey)
    
    const newCache: ModelCache = {
      version: 1,
      lastUpdated: now,
      models,
      cliModels: CLI_EXCLUSIVE_MODELS
    }
    
    saveCacheToFile(newCache)
    return newCache
  } catch (error) {
    console.error('[iflow-models] Failed to fetch models, using cache:', error)
    // 返回旧缓存或默认缓存
    return cache.models.length > 0 ? cache : DEFAULT_MODELS_CACHE
  }
}

// 获取所有可用模型（API + CLI 独占）
export function getAllAvailableModels(cache: ModelCache): string[] {
  const apiModels = cache.models.map(m => m.id)
  const allModels = new Set([...apiModels, ...CLI_EXCLUSIVE_MODELS])
  return Array.from(allModels)
}

// 合并动态模型与静态配置
export interface MergedModelConfig {
  id: string
  name: string
  context: number
  output: number
  inputModalities: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
  outputModalities: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
  reasoning: boolean
  toolcall: boolean
  temperature: boolean
  family: string
  requiresCLI: boolean
  source: 'api' | 'cli' | 'static'
}

// 根据模型 ID 推断模型配置
export function inferModelConfig(modelId: string): MergedModelConfig {
  const needsCLI = requiresCLI(modelId)
  const isThinking = isThinkingModel(modelId)
  
  // 根据模型名称推断能力
  const hasVision = /vl|vision|glm-4\.6|glm-4\.7|glm-5(?!-thinking|-free)/.test(modelId)
  const hasToolCall = !/vl|vision/.test(modelId)
  const family = inferFamily(modelId)
  
  // 根据模型类型推断上下文长度
  const context = inferContextLength(modelId)
  const output = inferOutputLength(modelId)

  return {
    id: modelId,
    name: inferModelName(modelId),
    context,
    output,
    inputModalities: hasVision ? ['text', 'image'] : ['text'],
    outputModalities: ['text'],
    reasoning: isThinking,
    toolcall: hasToolCall,
    temperature: true,
    family,
    requiresCLI: needsCLI,
    source: needsCLI ? 'cli' : 'api'
  }
}

// 推断模型名称
function inferModelName(modelId: string): string {
  const nameMap: Record<string, string> = {
    'glm-5': 'GLM-5',
    'glm-5-free': 'GLM-5 Free',
    'glm-5-thinking': 'GLM-5 Thinking',
    'glm-4.6': 'GLM-4.6',
    'glm-4.7': 'GLM-4.7',
    'deepseek-v3': 'DeepSeek V3',
    'deepseek-v3.2': 'DeepSeek V3.2',
    'deepseek-r1': 'DeepSeek R1',
    'qwen3-max': 'Qwen3 Max',
    'qwen3-coder-plus': 'Qwen3 Coder Plus',
    'kimi-k2': 'Kimi K2',
  }
  return nameMap[modelId] || modelId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

// 推断模型家族
function inferFamily(modelId: string): string {
  if (modelId.startsWith('glm')) return 'glm'
  if (modelId.startsWith('deepseek-r')) return 'deepseek-r'
  if (modelId.startsWith('deepseek')) return 'deepseek'
  if (modelId.startsWith('qwen3-coder')) return 'qwen3-coder'
  if (modelId.startsWith('qwen3-vl')) return 'qwen3-vl'
  if (modelId.startsWith('qwen3')) return 'qwen3'
  if (modelId.startsWith('kimi')) return 'kimi'
  if (modelId.startsWith('iflow')) return 'iflow'
  return modelId.split('-')[0] || 'unknown'
}

// 推断上下文长度
function inferContextLength(modelId: string): number {
  if (modelId.includes('coder-plus')) return 1000000
  if (modelId.startsWith('glm-5') || modelId.includes('235b')) return 256000
  if (modelId.startsWith('glm-4.7') || modelId.includes('kimi-k2-0905')) return 256000
  if (modelId.startsWith('glm-4.6')) return 200000
  if (modelId.startsWith('qwen3') || modelId.startsWith('kimi')) return 256000
  return 128000
}

// 推断输出长度
function inferOutputLength(modelId: string): number {
  if (modelId.includes('coder-plus')) return 64000
  if (modelId.startsWith('glm-4.6')) return 128000
  if (modelId.includes('v3.2') || modelId.includes('kimi')) return 64000
  return 32000
}

// 刷新模型缓存
export async function refreshModelsCache(apiKey: string): Promise<ModelCache> {
  return getModels(apiKey, true)
}

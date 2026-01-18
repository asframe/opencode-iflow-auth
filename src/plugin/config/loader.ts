import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { IFlowConfigSchema, DEFAULT_CONFIG, type IFlowConfig } from './schema'

function getConfigDir(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'opencode')
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, 'opencode')
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'iflow-config.json')
}

export async function loadConfigFromFile(): Promise<Partial<IFlowConfig>> {
  try {
    const content = await fs.readFile(getConfigPath(), 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

export async function saveConfigToFile(config: Partial<IFlowConfig>): Promise<void> {
  const dir = getConfigDir()
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(getConfigPath(), JSON.stringify(config, null, 2))
}

export function mergeConfig(fileConfig: Partial<IFlowConfig>): IFlowConfig {
  return IFlowConfigSchema.parse({ ...DEFAULT_CONFIG, ...fileConfig })
}

export async function loadConfig(): Promise<IFlowConfig> {
  const fileConfig = await loadConfigFromFile()
  return mergeConfig(fileConfig)
}

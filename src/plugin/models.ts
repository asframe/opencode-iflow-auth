import { SUPPORTED_MODELS } from '../constants'

export function getSupportedModels(): string[] {
  return SUPPORTED_MODELS
}

export function isModelSupported(model: string): boolean {
  return SUPPORTED_MODELS.includes(model)
}

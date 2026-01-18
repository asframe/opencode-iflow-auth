import { encoding_for_model } from 'tiktoken'

export interface UsageInfo {
  usedCount: number
  limitCount: number
  email: string
}

const encoder = encoding_for_model('gpt-4')

export function countTokens(text: string): number {
  try {
    return encoder.encode(text).length
  } catch {
    return Math.ceil(text.length / 4)
  }
}

export function estimateTokensFromMessages(messages: any[]): number {
  let total = 0
  for (const msg of messages) {
    if (msg.content) {
      total += countTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
    }
    if (msg.role) {
      total += countTokens(msg.role)
    }
    total += 4
  }
  return total
}

export async function fetchUsageLimits(auth: any): Promise<UsageInfo> {
  return {
    usedCount: 0,
    limitCount: 0,
    email: auth.email || 'unknown'
  }
}

export async function updateAccountQuota(accountId: string, tokensUsed: number): Promise<void> {
}

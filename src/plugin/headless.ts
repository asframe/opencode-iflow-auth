import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

export function isHeadlessEnvironment(): boolean {
  return !!(
    process.env.SSH_CONNECTION ||
    process.env.SSH_CLIENT ||
    process.env.SSH_TTY ||
    process.env.OPENCODE_HEADLESS ||
    process.env.CI ||
    process.env.CONTAINER ||
    (process.platform !== 'win32' && !process.env.DISPLAY)
  )
}

export async function promptOAuthCallback(): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    console.log('\n' + '='.repeat(60))
    console.log('Headless environment detected!')
    console.log('Please complete authentication in your local browser.')
    console.log('After authorization, paste the callback URL or authorization code.')
    console.log('='.repeat(60) + '\n')
    
    const answer = await rl.question('Paste callback URL or authorization code: ')
    return answer.trim()
  } finally {
    rl.close()
  }
}

export async function promptWaitForOAuth(): Promise<void> {
  const rl = createInterface({ input, output })
  try {
    console.log('\n' + '='.repeat(60))
    console.log('OAuth server is running. Waiting for callback...')
    console.log('Open the URL above in your browser to complete authentication.')
    console.log('='.repeat(60) + '\n')
    
    await rl.question('Press Enter after completing authentication in browser...')
  } finally {
    rl.close()
  }
}

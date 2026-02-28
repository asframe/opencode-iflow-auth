import { spawn, ChildProcess, execSync, exec } from 'child_process'
import { createServer, Server, IncomingMessage, ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { requiresCLI } from './models.js'

const IFLOW_PROXY_PORT = 19998
const IFLOW_PROXY_HOST = '127.0.0.1'
const IFLOW_API_BASE = 'https://apis.iflow.cn'

const DEBUG = process.env.IFLOW_PROXY_DEBUG === 'true'
const AUTO_INSTALL_CLI = process.env.IFLOW_AUTO_INSTALL_CLI !== 'false'
const AUTO_LOGIN = false

function log(...args: any[]) {
  if (DEBUG) {
    console.error('[IFlowProxy]', ...args)
  }
}

function getIFlowConfigPath(): string {
  return join(homedir(), '.iflow')
}

function getIFlowOAuthCredsPath(): string {
  return join(getIFlowConfigPath(), 'oauth_creds.json')
}

interface ChatMessage {
  role: string
  content: string
}

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
  [key: string]: any
}

interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface StreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
    }
    finish_reason: string | null
  }>
}

function checkIFlowCLI(): { installed: boolean; version?: string; error?: string } {
  try {
    const configPath = getIFlowConfigPath()
    const credsPath = getIFlowOAuthCredsPath()
    
    if (existsSync(configPath) || existsSync(credsPath)) {
      log('iflow CLI config found at:', configPath)
      return { installed: true, version: 'installed' }
    }
    
    execSync('where iflow 2>nul || which iflow 2>/dev/null', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    log('iflow CLI executable found')
    return { installed: true, version: 'installed' }
  } catch (error: any) {
    log('iflow CLI check failed:', error.message)
    return { installed: false, error: 'iflow CLI not found' }
  }
}

function checkIFlowLogin(): { loggedIn: boolean; error?: string; apiKey?: string } {
  try {
    const oauthCredsPath = getIFlowOAuthCredsPath()
    
    if (!existsSync(oauthCredsPath)) {
      log('OAuth creds file not found:', oauthCredsPath)
      return { loggedIn: false, error: 'Not logged in - no oauth_creds.json' }
    }
    
    const credsContent = readFileSync(oauthCredsPath, 'utf-8')
    const creds = JSON.parse(credsContent)
    
    if (!creds.access_token && !creds.apiKey) {
      return { loggedIn: false, error: 'Not logged in - no token' }
    }
    
    if (creds.expiry_date && Date.now() > creds.expiry_date) {
      return { loggedIn: false, error: 'Token expired' }
    }
    
    log('iflow CLI is logged in:', creds.userName || creds.userId)
    return { loggedIn: true, apiKey: creds.apiKey }
  } catch (error: any) {
    log('Error checking iflow login:', error.message)
    return { loggedIn: false, error: error.message }
  }
}

async function triggerIFlowLogin(): Promise<{ success: boolean; error?: string }> {
  log('Triggering iflow login...')
  console.error('[IFlowProxy] Please login to iflow CLI...')
  console.error('[IFlowProxy] Run: iflow login')
  
  return new Promise((resolve) => {
    const loginProcess = spawn('iflow', ['login'], {
      shell: true,
      stdio: 'inherit'
    })
    
    loginProcess.on('close', (code) => {
      if (code === 0) {
        log('iflow login successful')
        resolve({ success: true })
      } else {
        resolve({ success: false, error: `Login process exited with code ${code}` })
      }
    })
    
    loginProcess.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

async function installIFlowCLI(): Promise<{ success: boolean; error?: string }> {
  log('Attempting to install iflow CLI...')
  console.error('[IFlowProxy] Installing iflow CLI...')
  
  return new Promise((resolve) => {
    try {
      const npm = spawn('npm', ['install', '-g', 'iflow-cli'], {
        shell: true,
        stdio: 'inherit'
      })

      npm.on('error', (err) => {
        console.error('[IFlowProxy] Failed to install iflow CLI:', err.message)
        resolve({ success: false, error: err.message })
      })

      npm.on('close', (code) => {
        if (code === 0) {
          console.error('[IFlowProxy] iflow CLI installed successfully!')
          console.error('[IFlowProxy] Please run: iflow login')
          resolve({ success: true })
        } else {
          console.error('[IFlowProxy] Installation failed with code:', code)
          resolve({ success: false, error: `npm install exited with code ${code}` })
        }
      })
    } catch (error: any) {
      console.error('[IFlowProxy] Failed to start npm install:', error.message)
      resolve({ success: false, error: error.message })
    }
  })
}

export class IFlowCLIProxy {
  private server: Server | null = null
  private port: number
  private host: string
  private cliAvailable: boolean = false
  private cliLoggedIn: boolean = false
  private cliChecked: boolean = false

  constructor(port: number = IFLOW_PROXY_PORT, host: string = IFLOW_PROXY_HOST) {
    this.port = port
    this.host = host
  }

  async start(): Promise<void> {
    if (this.server) {
      return
    }

    if (!this.cliChecked) {
      let cliCheck = checkIFlowCLI()
      
      if (!cliCheck.installed && AUTO_INSTALL_CLI) {
        const installResult = await installIFlowCLI()
        if (installResult.success) {
          cliCheck = checkIFlowCLI()
        }
      }
      
      this.cliAvailable = cliCheck.installed
      this.cliChecked = true
      
      if (cliCheck.installed) {
        const loginCheck = checkIFlowLogin()
        this.cliLoggedIn = loginCheck.loggedIn
        
        if (!loginCheck.loggedIn) {
          console.error('')
          console.error('[IFlowProxy] ══════════════════════════════════════════════════════════')
          console.error('[IFlowProxy] WARNING: iflow CLI is not logged in')
          console.error('[IFlowProxy] ══════════════════════════════════════════════════════════')
          console.error('[IFlowProxy] To use GLM-5 models, please login to iflow CLI:')
          console.error('[IFlowProxy]')
          console.error('[IFlowProxy]   iflow login')
          console.error('[IFlowProxy]')
          console.error('[IFlowProxy] Or set IFLOW_AUTO_LOGIN=false to disable auto-login')
          console.error('[IFlowProxy] ══════════════════════════════════════════════════════════')
          console.error('')
          
          if (AUTO_LOGIN) {
            const loginResult = await triggerIFlowLogin()
            if (loginResult.success) {
              this.cliLoggedIn = true
              console.error('[IFlowProxy] Login successful!')
            }
          }
        } else {
          log('iflow CLI is logged in')
        }
      }
      
      if (!cliCheck.installed) {
        console.error('')
        console.error('[IFlowProxy] ══════════════════════════════════════════════════════════')
        console.error('[IFlowProxy] WARNING: iflow CLI is not installed')
        console.error('[IFlowProxy] ══════════════════════════════════════════════════════════')
        console.error('[IFlowProxy] To use GLM-5 models, please install iflow CLI:')
        console.error('[IFlowProxy]')
        console.error('[IFlowProxy]   npm install -g iflow-cli')
        console.error('[IFlowProxy]   iflow login')
        console.error('[IFlowProxy]')
        console.error('[IFlowProxy] Or set IFLOW_AUTO_INSTALL_CLI=false to disable auto-install')
          console.error('[IFlowProxy] ══════════════════════════════════════════════════════════')
          console.error('')
      } else {
        log('iflow CLI is available:', cliCheck.version)
      }
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res)
      })

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${this.port} already in use, assuming server is running`)
          resolve()
        } else {
          reject(err)
        }
      })

      this.server.listen(this.port, this.host, () => {
        log(`Smart proxy started on http://${this.host}:${this.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null
        log('Server stopped')
        resolve()
      })
    })
  }

  getBaseUrl(): string {
    return `http://${this.host}:${this.port}`
  }

  isCLIAvailable(): boolean {
    return this.cliAvailable
  }

  isCLILoggedIn(): boolean {
    return this.cliLoggedIn
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    const url = req.url || ''

    if (url === '/v1/chat/completions') {
      await this.handleChatCompletions(req, res)
    } else if (url === '/v1/models') {
      this.handleModels(res)
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  }

  private async handleChatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 提取 Authorization header
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
    const authStr = Array.isArray(authHeader) ? (authHeader[0] || '') : authHeader
    const apiKey = authStr.replace('Bearer ', '')
    
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const request: ChatCompletionRequest = JSON.parse(body)
        const model = request.model
        const isStream = request.stream === true

        log(`Request for model: ${model}, requires CLI: ${requiresCLI(model)}`)

        if (requiresCLI(model)) {
          if (!this.cliAvailable) {
            log(`CLI not installed for model: ${model}`)
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ 
              error: 'iflow CLI is not installed. Please install it with: npm install -g iflow-cli',
              install_hint: 'npm install -g iflow-cli'
            }))
            return
          }
          
          if (!this.cliLoggedIn) {
            log(`CLI not logged in for model: ${model}`)
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ 
              error: 'iflow CLI is not logged in. Please run: iflow login',
              login_hint: 'iflow login'
            }))
            return
          }
          
          log(`Using CLI for model: ${model}`)
          if (isStream) {
            await this.handleCLIStreamRequest(request, res)
          } else {
            await this.handleCLINonStreamRequest(request, res)
          }
        } else {
          log(`Using direct API for model: ${model}`)
          await this.handleDirectAPIRequest(request, res, isStream, apiKey)
        }
      } catch (error: any) {
        log('Error parsing request:', error)
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request body' }))
      }
    })
  }

  private async handleDirectAPIRequest(request: ChatCompletionRequest, res: ServerResponse, isStream: boolean, apiKey: string): Promise<void> {
    try {
      const https = await import('https')
      
      const requestBody = JSON.stringify({
        ...request,
        model: request.model,
      })

      const options = {
        hostname: 'apis.iflow.cn',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Authorization': `Bearer ${apiKey}`
        }
      }

      const apiReq = https.request(options, (apiRes) => {
        res.writeHead(apiRes.statusCode || 200, apiRes.headers)
        apiRes.pipe(res)
      })

      apiReq.on('error', (err) => {
        log('Direct API error:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      })

      apiReq.write(requestBody)
      apiReq.end()
    } catch (error: any) {
      log('Direct API error:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error.message }))
    }
  }

  private async handleCLINonStreamRequest(request: ChatCompletionRequest, res: ServerResponse): Promise<void> {
    try {
      const result = await this.callIFlowCLI(request)
      
      const response: ChatCompletionResponse = {
        id: `iflow-${randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: result.content
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: result.promptTokens || 0,
          completion_tokens: result.completionTokens || 1,
          total_tokens: (result.promptTokens || 1) + (result.completionTokens || 1)
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error: any) {
      log('Error calling iflow CLI:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error.message || 'Internal server error' }))
    }
  }

  private async handleCLIStreamRequest(request: ChatCompletionRequest, res: ServerResponse): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })

    const chatId = `iflow-${randomUUID()}`
    const created = Math.floor(Date.now() / 1000)

    try {
      await this.callIFlowCLIStream(request, (content, done) => {
        const chunk: StreamChunk = {
          id: chatId,
          object: 'chat.completion.chunk',
          created: created,
          model: request.model,
          choices: [{
            index: 0,
            delta: done ? {} : { content },
            finish_reason: done ? 'stop' : null
          }]
        }

        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        
        if (done) {
          res.write('data: [DONE]\n\n')
          res.end()
        }
      })
    } catch (error: any) {
      log('Error in stream:', error)
      const errorChunk = {
        id: chatId,
        object: 'chat.completion.chunk',
        created: created,
        model: request.model,
        choices: [{
          index: 0,
          delta: { content: `\n\n[Error: ${error.message}]` },
          finish_reason: 'stop'
        }]
      }
      res.write(`data: ${JSON.stringify(errorChunk)}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }

  private handleModels(res: ServerResponse): void {
    const models = [
      { id: 'glm-5', object: 'model', created: 1700000000, owned_by: 'iflow' },
      { id: 'glm-4.6', object: 'model', created: 1700000000, owned_by: 'iflow' },
      { id: 'deepseek-v3.2', object: 'model', created: 1700000000, owned_by: 'iflow' },
      { id: 'kimi-k2', object: 'model', created: 1700000000, owned_by: 'iflow' },
    ]

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ object: 'list', data: models }))
  }

  private async callIFlowCLI(request: ChatCompletionRequest): Promise<{ content: string; promptTokens?: number; completionTokens?: number }> {
    return new Promise((resolve, reject) => {
      const prompt = this.buildPrompt(request.messages)
      
      const args = [
        '-m', request.model,
        '--no-stream'
      ]

      log(`Calling iflow with stdin, prompt length: ${prompt.length}`)

      const iflow: ChildProcess = spawn('iflow', args, {
        shell: true,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      })

      let stdout = ''
      let stderr = ''

      iflow.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      iflow.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      iflow.on('error', (err) => {
        log('Failed to start iflow:', err)
        reject(new Error(`Failed to start iflow: ${err.message}`))
      })

      iflow.on('close', (code) => {
        if (code !== 1) {
          log('iflow exited with code:', code, stderr)
          reject(new Error(`iflow exited with code ${code}`))
          return
        }

        const content = stdout.trim()
        log('iflow response length:', content.length)
        
        resolve({
          content,
          promptTokens: 1,
          completionTokens: 1
        })
      })

      iflow.stdin?.write(prompt)
      iflow.stdin?.end()
    })
  }

  private async callIFlowCLIStream(
    request: ChatCompletionRequest,
    onChunk: (content: string, done: boolean) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const prompt = this.buildPrompt(request.messages)
      
      const args = [
        '-m', request.model
      ]

      log(`Calling iflow (stream) with stdin, prompt length: ${prompt.length}`)

      const iflow: ChildProcess = spawn('iflow', args, {
        shell: true,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      })

      let resolved = false

      iflow.stdout?.on('data', (data) => {
        const chunk = data.toString()
        onChunk(chunk, false)
      })

      iflow.stderr?.on('data', () => {})

      iflow.on('error', (err) => {
        log('Failed to start iflow:', err)
        if (!resolved) {
          resolved = true
          reject(new Error(`Failed to start iflow: ${err.message}`))
        }
      })

      iflow.on('close', (code) => {
        if (code !== 1 && !resolved) {
          log('iflow exited with code:', code)
          resolved = true
          reject(new Error(`iflow exited with code ${code}`))
          return
        }

        if (!resolved) {
          resolved = true
          onChunk('', true)
          resolve()
        }
      })

      iflow.stdin?.write(prompt)
      iflow.stdin?.end()
    })
  }

  private buildPrompt(messages: ChatMessage[]): string {
    const parts: string[] = []
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        parts.push(`System: ${msg.content}`)
      } else if (msg.role === 'user') {
        parts.push(msg.content)
      } else if (msg.role === 'assistant') {
        parts.push(`Assistant: ${msg.content}`)
      }
    }

    return parts.join('\n\n')
  }
}

let proxyInstance: IFlowCLIProxy | null = null

export function getProxyInstance(): IFlowCLIProxy {
  if (!proxyInstance) {
    proxyInstance = new IFlowCLIProxy()
  }
  return proxyInstance
}

export async function startProxy(): Promise<IFlowCLIProxy> {
  const proxy = getProxyInstance()
  await proxy.start()
  return proxy
}

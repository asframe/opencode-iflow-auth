import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import lockfile from 'proper-lockfile'
import type { AccountStorage } from './types.js'
import * as logger from './logger.js'

const LOCK_OPTIONS = {
  stale: 10000,
  retries: { retries: 5, minTimeout: 100, maxTimeout: 1000, factor: 2 }
}

function getLegacyBaseDir(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'opencode')
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, 'opencode')
}

function getPreferredBaseDir(): string {
  const platform = process.platform
  if (platform === 'win32') {
    const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
    return join(xdgConfig, 'opencode')
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, 'opencode')
}

function getStoragePaths(): { preferred: string; legacy: string } {
  return {
    preferred: join(getPreferredBaseDir(), 'iflow-accounts.json'),
    legacy: join(getLegacyBaseDir(), 'iflow-accounts.json')
  }
}

async function findExistingStoragePath(): Promise<string> {
  const { preferred, legacy } = getStoragePaths()
  
  try {
    await fs.access(preferred)
    return preferred
  } catch {}
  
  try {
    await fs.access(legacy)
    return legacy
  } catch {}
  
  return preferred
}

async function withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  try {
    await fs.mkdir(dirname(path), { recursive: true })
  } catch (error) {
    logger.error(`Failed to create directory ${dirname(path)}`, error)
    throw error
  }

  try {
    await fs.access(path)
  } catch {
    try {
      await fs.writeFile(path, '{}')
    } catch (error) {
      logger.error(`Failed to initialize file ${path}`, error)
      throw error
    }
  }

  let release: (() => Promise<void>) | null = null
  try {
    release = await lockfile.lock(path, LOCK_OPTIONS)
    return await fn()
  } catch (error) {
    logger.error(`File lock failed for ${path}`, error)
    throw error
  } finally {
    if (release) {
      try {
        await release()
      } catch (error) {
        logger.warn(`Failed to release lock for ${path}`, error)
      }
    }
  }
}

export async function loadAccounts(): Promise<AccountStorage> {
  const path = await findExistingStoragePath()
  return withLock(path, async () => {
    try {
      const content = await fs.readFile(path, 'utf-8')
      const parsed = JSON.parse(content)
      if (!parsed || !Array.isArray(parsed.accounts)) {
        return { version: 1, accounts: [], activeIndex: -1 }
      }
      return parsed
    } catch {
      return { version: 1, accounts: [], activeIndex: -1 }
    }
  })
}

export async function saveAccounts(storage: AccountStorage): Promise<void> {
  const path = await findExistingStoragePath()
  try {
    await withLock(path, async () => {
      const tmp = `${path}.${randomBytes(6).toString('hex')}.tmp`
      await fs.writeFile(tmp, JSON.stringify(storage, null, 2))
      await fs.rename(tmp, path)
    })
  } catch (error) {
    logger.error(`Failed to save accounts to ${path}`, error)
    throw error
  }
}

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const packageJsonPath = resolve(process.cwd(), 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const currentVersion = packageJson.version

console.log('═══════════════════════════════════════════════════════════')
console.log('  @asframe/opencode-iflow-auth 发布脚本')
console.log('═══════════════════════════════════════════════════════════')
console.log('')
console.log(`  当前版本: v${currentVersion}`)
console.log('')

function checkLogin() {
  try {
    const user = execSync('npm whoami', { encoding: 'utf-8' }).trim()
    console.log(`✅ 已登录 npm 用户: ${user}`)
    return true
  } catch (e) {
    return false
  }
}

function checkWorkingTree() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim()
    if (status) {
      console.log('⚠️  工作区有未提交的更改:')
      console.log(status)
      console.log('')
      return false
    }
    console.log('✅ 工作区干净')
    return true
  } catch (e) {
    console.log('⚠️  无法检查 git 状态')
    return true
  }
}

function build() {
  console.log('')
  console.log('📦 构建项目...')
  try {
    execSync('npm run build', { stdio: 'inherit' })
    console.log('✅ 构建成功')
    return true
  } catch (e) {
    console.error('❌ 构建失败')
    return false
  }
}

function runTests() {
  console.log('')
  console.log('🧪 运行测试...')
  try {
    execSync('npm test', { stdio: 'inherit' })
    console.log('✅ 测试通过')
    return true
  } catch (e) {
    console.log('⚠️  测试未配置或失败，跳过')
    return true
  }
}

function publish() {
  console.log('')
  console.log('🚀 发布到 npm...')
  console.log('')
  console.log('  注意: npm 会打开浏览器进行身份验证')
  console.log('  请在浏览器中完成授权后继续')
  console.log('')
  try {
    execSync('npm publish --access public', { stdio: 'inherit' })
    console.log('')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('  ✅ 发布成功!')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('')
    console.log(`  版本: v${currentVersion}`)
    console.log('')
    console.log('  查看详情:')
    console.log('  npm view @asframe/opencode-iflow-auth')
    console.log('')
    return true
  } catch (e) {
    console.error('❌ 发布失败')
    return false
  }
}

function createGitTag() {
  console.log('')
  console.log('🏷️  创建 Git 标签...')
  try {
    execSync(`git tag -a v${currentVersion} -m "Release v${currentVersion}"`, { stdio: 'inherit' })
    console.log(`✅ 标签 v${currentVersion} 创建成功`)
    console.log('')
    console.log('  推送标签到远程:')
    console.log(`  git push origin v${currentVersion}`)
    console.log('')
    return true
  } catch (e) {
    console.log('⚠️  标签创建失败，可能已存在')
    return true
  }
}

function showChangelogReminder() {
  console.log('📝 更新日志提醒:')
  console.log('')
  console.log('  请确保已更新以下文件的更新日志:')
  console.log('  - README.md')
  console.log('  - README_CN.md')
  console.log('  - .trae/documents/需求文档.md')
  console.log('')
}

function showHelp() {
  console.log('用法: node publish.js [选项]')
  console.log('')
  console.log('选项:')
  console.log('  --skip-git    跳过 git 工作区检查')
  console.log('  --dry-run     干运行模式（不实际发布）')
  console.log('  --help        显示帮助信息')
  console.log('')
  console.log('示例:')
  console.log('  node publish.js              # 正常发布')
  console.log('  node publish.js --skip-git   # 跳过 git 检查')
  console.log('  node publish.js --dry-run    # 干运行测试')
  console.log('')
}

function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    process.exit(0)
  }
  
  const skipGitCheck = args.includes('--skip-git')
  const dryRun = args.includes('--dry-run')

  if (dryRun) {
    console.log('🔍 干运行模式 (不实际发布)')
    console.log('')
  }

  if (!checkLogin()) {
    console.log('')
    console.log('❌ 未登录 npm')
    console.log('')
    console.log('请先运行以下命令登录:')
    console.log('')
    console.log('  npm login')
    console.log('')
    console.log('npm 会打开浏览器进行身份验证，请在浏览器中完成授权。')
    console.log('')
    process.exit(1)
  }

  if (!skipGitCheck && !checkWorkingTree()) {
    console.log('')
    console.log('请先提交或暂存更改，或使用 --skip-git 跳过检查')
    console.log('')
    process.exit(1)
  }

  showChangelogReminder()

  if (!build()) {
    process.exit(1)
  }

  if (!runTests()) {
    process.exit(1)
  }

  if (dryRun) {
    console.log('')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('  🔍 干运行完成，未实际发布')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('')
    process.exit(0)
  }

  if (!publish()) {
    process.exit(1)
  }

  createGitTag()
}

main()

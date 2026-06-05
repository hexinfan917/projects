const ci = require('miniprogram-ci')
const path = require('path')
const fs = require('fs')

const PROJECT_PATH = __dirname
const APPID = 'wxdf099f340581f93d'
const PRIVATE_KEY_PATH = path.join(PROJECT_PATH, 'private.key')

// 检查密钥文件是否存在
if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error('❌ 上传密钥文件不存在: private.key')
  console.error('')
  console.error('请按以下步骤获取并放置密钥：')
  console.error('1. 登录微信小程序后台: https://mp.weixin.qq.com/')
  console.error('2. 前往「开发」→「开发设置」→「小程序代码上传」')
  console.error('3. 点击「生成」或「下载」上传密钥（private.key）')
  console.error('4. 将下载的 private.key 文件放到项目根目录: frontend/miniapp/private.key')
  console.error('')
  process.exit(1)
}

// 从命令行获取版本号和描述
const version = process.argv[2] || '1.0.0'
const desc = process.argv[3] || '更新版本'

async function upload() {
  try {
    const project = new ci.Project({
      appid: APPID,
      type: 'miniProgram',
      projectPath: path.join(PROJECT_PATH, 'dist'),
      privateKeyPath: PRIVATE_KEY_PATH,
      ignores: ['node_modules/**/*'],
    })

    console.log(`🚀 开始上传小程序...`)
    console.log(`   版本: ${version}`)
    console.log(`   描述: ${desc}`)
    console.log('')

    const uploadResult = await ci.upload({
      project,
      version,
      desc,
      setting: {
        es6: true,
        es7: true,
        minify: true,
        codeProtect: false,
        autoPrefixWXSS: true,
      },
      onProgressUpdate: (info) => {
        if (info._msg) {
          console.log(`   ${info._msg}`)
        }
      },
    })

    console.log('')
    console.log('✅ 上传成功！')
    console.log(`   版本: ${uploadResult.subPackageInfo?.[0]?.name || 'main'}`)
    console.log('')
    console.log('下一步：')
    console.log('1. 登录微信小程序后台: https://mp.weixin.qq.com/')
    console.log('2. 前往「版本管理」→「开发版本」')
    console.log('3. 点击「提交审核」')
  } catch (err) {
    console.error('')
    console.error('❌ 上传失败:', err.message)
    process.exit(1)
  }
}

upload()

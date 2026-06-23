import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Provider } from './store'
import './styles/global.scss'

function App({ children }) {
  useEffect(() => {
    // 小程序启动时执行
    console.log('App launched')

    // 清除弹窗关闭标记，确保重新进入小程序后弹窗可以正常显示
    Taro.removeStorageSync('home_popup_dismissed')

    // 检查登录状态
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      console.log('User not logged in')
    }

    // 获取公开系统设置（版本号等）
    const systemInfo = Taro.getSystemInfoSync()
    const isDevtools = systemInfo.platform === 'devtools'
    // 开发工具固定走 localhost，避免 build 模式被 Taro 覆盖 NODE_ENV 后命中线上
    const baseUrl = isDevtools
      ? 'http://localhost:8081'
      : (process.env.NODE_ENV === 'development' ? 'http://192.168.8.46:8081' : 'https://tailtravel.cn')
    Taro.request({
      url: `${baseUrl}/api/v1/settings/public`,
      method: 'GET',
      success: (res: any) => {
        if (res.data?.code === 200 && res.data.data?.mp_version) {
          Taro.setStorageSync('app_version', res.data.data.mp_version.value)
          console.log('[App] 版本号已更新:', res.data.data.mp_version.value)
        }
      }
    })

    // 检查小程序更新
    const updateManager = Taro.getUpdateManager()
    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        console.log('[Update] 发现新版本')
      }
    })
    updateManager.onUpdateReady(() => {
      Taro.showModal({
        title: '版本更新',
        content: '新版本已准备好，重启后即可使用最新功能',
        confirmText: '立即重启',
        cancelText: '稍后',
        success: (modalRes) => {
          if (modalRes.confirm) {
            updateManager.applyUpdate()
          }
        },
      })
    })
    updateManager.onUpdateFailed(() => {
      console.error('[Update] 新版本下载失败')
    })
  }, [])

  return (
    <Provider>
      {children}
    </Provider>
  )
}

export default App

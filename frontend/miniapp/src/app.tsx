import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Provider } from './store'
import { BASE_URL } from './utils/api'
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
    Taro.request({
      url: `${BASE_URL}/api/v1/settings/public`,
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
        showCancel: false,
        success: () => {
          updateManager.applyUpdate()
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

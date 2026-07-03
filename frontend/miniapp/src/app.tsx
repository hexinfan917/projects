import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Provider } from './store'
import { getPublicSettings } from './utils/api'
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

    // 加载公开系统设置（如小程序版本号）
    const loadPublicSettings = async () => {
      try {
        const res: any = await getPublicSettings()
        if (res.code === 200 && res.data) {
          const versionSetting = res.data.mp_version
          if (versionSetting?.value) {
            Taro.setStorageSync('app_version', versionSetting.value)
            console.log('[App] 小程序版本号:', versionSetting.value)
          }
        }
      } catch (e) {
        console.error('[App] 加载公开设置失败:', e)
      }
    }
    loadPublicSettings()

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
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate()
          }
        }
      })
    })
  }, [])

  return (
    <Provider>
      {children}
    </Provider>
  )
}

export default App

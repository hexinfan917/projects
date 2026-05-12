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
  }, [])

  return (
    <Provider>
      {children}
    </Provider>
  )
}

export default App

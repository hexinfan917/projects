import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Provider } from './store'
import './styles/global.scss'

function App({ children }) {
  useEffect(() => {
    // 小程序启动时执行
    console.log('App launched')
    
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

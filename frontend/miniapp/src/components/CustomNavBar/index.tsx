import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import './index.scss'

interface CustomNavBarProps {
  title?: string
  backgroundColor?: string
  color?: string
  showBack?: boolean
  onBack?: () => void
}

export default function CustomNavBar({
  title = '',
  backgroundColor = '#ffffff',
  color = '#1f2937',
  showBack = true,
  onBack,
}: CustomNavBarProps) {
  const [navStyle, setNavStyle] = useState({
    statusBarHeight: 20,
    navBarHeight: 44,
  })

  useEffect(() => {
    try {
      const systemInfo = Taro.getSystemInfoSync()
      const menuButtonInfo = Taro.getMenuButtonBoundingClientRect() || {}

      const statusBarHeight = systemInfo.statusBarHeight || 20
      const platform = systemInfo.platform || ''
      const defaultNavHeight = platform === 'ios' || platform === 'devtools' ? 44 : 48

      const navBarHeight = menuButtonInfo.height
        ? menuButtonInfo.height + Math.max(0, (menuButtonInfo.top || 0) - statusBarHeight) * 2
        : defaultNavHeight

      setNavStyle({ statusBarHeight, navBarHeight })
    } catch (e) {
      console.warn('CustomNavBar 获取系统信息失败:', e)
    }
  }, [])

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
    } else {
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

  return (
    <View
      className='dp-custom-navbar'
      style={{
        backgroundColor,
        paddingTop: `${navStyle.statusBarHeight}px`,
        height: `${navStyle.navBarHeight}px`,
      }}
    >
      {showBack && (
        <View className='dp-navbar-back' onClick={handleBack}>
          <View className='dp-navbar-back-arrow' style={{ borderColor: color }} />
        </View>
      )}
      <Text className='dp-navbar-title' style={{ color, lineHeight: `${navStyle.navBarHeight}px` }}>
        {title}
      </Text>
    </View>
  )
}

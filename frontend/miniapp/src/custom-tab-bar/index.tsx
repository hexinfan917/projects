import { useState, useEffect } from 'react'
import Taro, { eventCenter } from '@tarojs/taro'
import { View, Image, Text } from '@tarojs/components'
import { TAB_BAR_SELECT_EVENT } from './constants'
import './index.scss'

const TABS = [
  { pagePath: '/pages/index/index', text: '首页', iconPath: '../assets/icons/tab-home.png', activeIconPath: '../assets/icons/tab-home.png' },
  { pagePath: '/pages/routes/index', text: '活动', iconPath: '../assets/icons/tab-route.png', activeIconPath: '../assets/icons/tab-route.png' },
  { pagePath: '/pages/profile/pets/index', text: '档案', iconPath: '../assets/icons/tab-pet.png', activeIconPath: '../assets/icons/tab-pet.png' },
  { pagePath: '/pages/profile/index', text: '我的', iconPath: '../assets/icons/tab-profile.png', activeIconPath: '../assets/icons/tab-profile.png' },
]

export default function CustomTabBar(props: { selected?: number }) {
  const [selected, setSelected] = useState(props.selected ?? 0)

  const updateFromRoute = () => {
    const pages = Taro.getCurrentPages()
    const route = (pages[pages.length - 1]?.route || '').replace(/\.html$/, '')
    const idx = TABS.findIndex(t => t.pagePath.replace(/^\//, '') === route)
    if (idx >= 0) setSelected(idx)
  }

  useEffect(() => {
    if (props.selected !== undefined) setSelected(props.selected)
    updateFromRoute()
    eventCenter.on(TAB_BAR_SELECT_EVENT, updateFromRoute)
    return () => eventCenter.off(TAB_BAR_SELECT_EVENT, updateFromRoute)
  }, [props.selected])

  const switchTab = (index: number) => {
    if (index === selected) return
    setSelected(index)
    eventCenter.trigger(TAB_BAR_SELECT_EVENT, index)
    Taro.switchTab({ url: TABS[index].pagePath })
  }

  return (
    <View className='custom-tab-bar'>
      <View className='custom-tab-bar-inner'>
        {TABS.map((tab, index) => {
          const isSelected = index === selected
          return (
            <View key={tab.pagePath} className={`custom-tab-item ${isSelected ? 'custom-tab-item-active' : ''}`} onClick={() => switchTab(index)}>
              <View className='custom-tab-active-bg' />
              <Image className='custom-tab-icon' src={isSelected ? tab.activeIconPath : tab.iconPath} mode='aspectFit' />
              <Text className='custom-tab-text'>{tab.text}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

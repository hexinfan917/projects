import Taro from '@tarojs/taro'
import { View, Image, Text } from '@tarojs/components'
import './index.scss'

const TABS = [
  {
    pagePath: '/pages/index/index',
    text: '首页',
    iconPath: '../assets/icons/tab-home.svg'
  },
  {
    pagePath: '/pages/routes/index',
    text: '活动',
    iconPath: '../assets/icons/tab-route.svg'
  },
  {
    pagePath: '/pages/profile/pets/index',
    text: '档案',
    iconPath: '../assets/icons/tab-pet.svg'
  },
  {
    pagePath: '/pages/profile/index',
    text: '我的',
    iconPath: '../assets/icons/tab-profile.svg'
  }
]

export default function CustomTabBar(props: { selected?: number }) {
  const selected = props.selected ?? 0

  const switchTab = (index: number) => {
    if (index === selected) return
    Taro.switchTab({ url: TABS[index].pagePath })
  }

  return (
    <View className='custom-tab-bar'>
      <View className='custom-tab-bar-inner'>
        {TABS.map((tab, index) => {
          const isSelected = index === selected
          return (
            <View
              key={tab.pagePath}
              className={`custom-tab-item ${isSelected ? 'custom-tab-item-active' : ''}`}
              onClick={() => switchTab(index)}
            >
              <View className='custom-tab-icon-wrap'>
                <Image
                  className='custom-tab-icon'
                  src={tab.iconPath}
                  mode='aspectFit'
                />
              </View>
              <Text className='custom-tab-text'>{tab.text}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Switch } from '@tarojs/components'
import './index.scss'

const MENU_ITEMS = [
  { label: '账号与安全', path: '/pages/profile/security/index' },
  { label: '隐私政策', path: '/pages/profile/privacy/index' },
  { label: '用户协议', path: '/pages/profile/terms/index' },
  { label: '清除缓存', action: 'clear' },
]

export default function Settings() {
  const [notifications, setNotifications] = useState({ order: true, activity: true, system: true })

  useEffect(() => {
    const saved = Taro.getStorageSync('notification_settings')
    if (saved) setNotifications(saved)
  }, [])

  const saveNotifications = (next: any) => {
    setNotifications(next)
    Taro.setStorageSync('notification_settings', next)
  }

  const handleItem = (item: any) => {
    if (item.path) {
      Taro.navigateTo({ url: item.path })
    } else if (item.action === 'clear') {
      Taro.showModal({
        title: '提示',
        content: '确定要清除缓存吗？',
        success: (res) => {
          if (res.confirm) {
            Taro.clearStorage()
            Taro.showToast({ title: '缓存已清除', icon: 'success' })
            setNotifications({ order: true, activity: true, system: true })
          }
        }
      })
    }
  }

  return (
    <View className='settings-page'>
      <View className='settings-group'>
        <Text className='group-title'>消息通知</Text>
        <View className='settings-list'>
          <View className='settings-item'>
            <Text className='settings-label'>订单消息</Text>
            <Switch checked={notifications.order} onChange={(e) => saveNotifications({ ...notifications, order: e.detail.value })} color='#22C55E' />
          </View>
          <View className='settings-item'>
            <Text className='settings-label'>活动优惠</Text>
            <Switch checked={notifications.activity} onChange={(e) => saveNotifications({ ...notifications, activity: e.detail.value })} color='#22C55E' />
          </View>
          <View className='settings-item'>
            <Text className='settings-label'>系统通知</Text>
            <Switch checked={notifications.system} onChange={(e) => saveNotifications({ ...notifications, system: e.detail.value })} color='#22C55E' />
          </View>
        </View>
      </View>

      <View className='settings-group'>
        <Text className='group-title'>其他设置</Text>
        <View className='settings-list'>
          {MENU_ITEMS.map(item => (
            <View key={item.label} className='settings-item' onClick={() => handleItem(item)}>
              <Text className='settings-label'>{item.label}</Text>
              {item.action === 'clear' ? (
                <Text className='settings-arrow'>></Text>
              ) : (
                <Text className='settings-arrow'>></Text>
              )}
            </View>
          ))}
        </View>
      </View>

      <View className='version-section'>
        <Text className='version-text'>Version 1.0.0</Text>
      </View>
    </View>
  )
}

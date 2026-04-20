import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { getUserProfile, setActiveTab } from '../../utils/api'
import './index.scss'

const SERVICES = [
  { label: '优惠券', icon: '🎫', count: 5 },
  { label: '收藏夹', icon: '⭐', count: 12 },
  { label: '浏览足迹', icon: '👣' },
  { label: '地址管理', icon: '📍' },
]

const MORE = [
  { label: '出行人管理', icon: '👤', path: '/pages/profile/travelers/index' },
  { label: '我的足迹', icon: '👣', path: '/pages/profile/footprint/index' },
  { label: '联系客服', icon: '🎧', action: 'service' },
  { label: '关于我们', icon: 'ℹ️', path: '/pages/profile/about/index' },
  { label: '设置', icon: '⚙️', path: '/pages/profile/settings/index' },
]

const showDeveloping = () => {
  Taro.showToast({ title: '功能开发中', icon: 'none' })
}

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [serviceVisible, setServiceVisible] = useState(false)

  const loadUser = () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      setUser(null)
      return
    }
    getUserProfile().then(res => setUser(res.data)).catch(() => {
      const cache = Taro.getStorageSync('user_info')
      if (cache) setUser(cache)
    })
  }

  useDidShow(() => {
    setActiveTab(3, 'pages/profile/index')
    loadUser()
  })

  useEffect(() => {
    loadUser()
  }, [])

  const goLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  const checkLogin = () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return false
    }
    return true
  }

  const goOrders = (status?: string) => {
    if (!checkLogin()) return
    Taro.navigateTo({ url: `/pages/orders/list/index${status ? '?status=' + status : ''}` })
  }

  const WECHAT_ID = 'Petway_'

  const copyWechat = () => {
    Taro.setClipboardData({ data: WECHAT_ID }).then(() => {
      Taro.showToast({ title: '微信号已复制', icon: 'none' })
      setServiceVisible(false)
    }).catch(() => {
      Taro.showModal({
        title: '复制微信号',
        content: `微信号：${WECHAT_ID}\n\n（模拟器复制功能受限，请手动复制）`,
        showCancel: false,
        confirmText: '知道了',
        success: () => setServiceVisible(false)
      })
    })
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.removeStorageSync('access_token')
          Taro.removeStorageSync('user_info')
          setUser(null)
          Taro.showToast({ title: '已退出登录', icon: 'none' })
        }
      }
    })
  }

  return (
    <View className='profile-page'>
      <View className='user-header'>
        <View className='user-top'>
          {user?.avatar ? (
            <Image className='avatar' src={user.avatar} mode='aspectFill' style={{ width: '120rpx', height: '120rpx' }} />
          ) : (
            <View className='avatar avatar-placeholder' />
          )}
          <View className='user-info'>
            {user ? (
              <>
                <Text className='nickname'>{user.nickname || '宠友'}</Text>
              </>
            ) : (
              <View className='login-wrap' onClick={goLogin}>
                <Text className='login-text'>点击登录 / 注册</Text>
              </View>
            )}
          </View>
        </View>
        <View className='user-actions'>
          <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/profile/edit/index' })}>
            <Text className='action-btn-text'>编辑资料</Text>
          </View>
        </View>
      </View>

      <View className='card'>
        <View className='card-header'>
          <Text className='card-title'>我的订单</Text>
          <View className='card-more' onClick={() => goOrders()}>
            <Text className='card-more-text'>全部 ></Text>
          </View>
        </View>
        <View className='order-entries'>
          <View className='entry' onClick={() => goOrders('10')}>
            <Text className='entry-icon'>💳</Text>
            <Text className='entry-label'>待支付</Text>
          </View>
          <View className='entry' onClick={() => goOrders('20')}>
            <Text className='entry-icon'>🎒</Text>
            <Text className='entry-label'>待出行</Text>
          </View>
          <View className='entry' onClick={() => goOrders('60')}>
            <Text className='entry-icon'>⭐</Text>
            <Text className='entry-label'>待评价</Text>
          </View>
          <View className='entry' onClick={showDeveloping}>
            <Text className='entry-icon'>🔄</Text>
            <Text className='entry-label'>退款/售后</Text>
          </View>
        </View>
      </View>

      <View className='card'>
        <View className='more-list'>
          {MORE.map(m => (
            <View
              key={m.label}
              className='more-item'
              onClick={() => {
                if (m.path && (m.label === '出行人管理' || m.label === '我的足迹')) {
                  if (!checkLogin()) return
                  Taro.navigateTo({ url: m.path })
                } else if (m.path) {
                  Taro.navigateTo({ url: m.path })
                } else if (m.action === 'service') {
                  setServiceVisible(true)
                } else {
                  showDeveloping()
                }
              }}
            >
              <Text className='more-icon'>{m.icon}</Text>
              <Text className='more-label'>{m.label}</Text>
              <Text className='more-arrow'>></Text>
            </View>
          ))}
        </View>
      </View>

      {serviceVisible && (
        <View className='service-modal'>
          <View className='service-mask' onClick={() => setServiceVisible(false)} />
          <View className='service-content'>
            <Text className='service-title'>联系客服</Text>
            <Text className='service-body'>工作时间：周一至周五{'\n'}10:00~20:00 微信号：{'\n'}Petway_</Text>
            <View className='service-btns'>
              <View className='service-btn cancel' onClick={() => setServiceVisible(false)}>
                <Text>取消</Text>
              </View>
              <View className='service-btn confirm' onClick={copyWechat}>
                <Text>复制微信</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {user && (
        <View className='logout-section'>
          <View className='logout-btn' onClick={handleLogout}>
            <Text className='logout-text'>退出登录</Text>
          </View>
        </View>
      )}
    </View>
  )
}

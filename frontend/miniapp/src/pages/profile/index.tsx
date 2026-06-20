import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { getUserProfile, setActiveTab, compressImageUrl } from '../../utils/api'
import './index.scss'

const topLogo = '/assets/toplogo.png'

const ICON_MAP: Record<string, string> = {
  '默认头像': '/assets/icons/profile/head.png',
  '待支付': '/assets/icons/profile/pending.png',
  '待出行': '/assets/icons/profile/travel.png',
  '已完成': '/assets/icons/profile/completed.png',
  '退款/售后': '/assets/icons/profile/refund.png',
  '会员中心': '/assets/icons/profile/vip.png',
  '优惠券': '/assets/icons/profile/coupon.png',
  '出行人管理': '/assets/icons/profile/traveler.png',
  '我的足迹': '/assets/icons/profile/footprint.png',
  '联系客服': '/assets/icons/profile/service.png',
  '关于我们': '/assets/icons/profile/about.png',
  '设置': '/assets/icons/profile/settings.png',
}

const ORDER_ENTRIES = [
  { label: '待支付', status: '10' },
  { label: '待出行', status: '20' },
  { label: '已完成', status: 'completed' },
  { label: '退款/售后', action: 'refund' },
]

const MENU = [
  { label: '会员中心', path: '/pages/member/center/index', needLogin: true },
  { label: '优惠券', path: '/pages/coupons/list/index', needLogin: true },
  { label: '出行人管理', path: '/pages/profile/travelers/index', needLogin: true },
  { label: '我的足迹', path: '/pages/profile/footprint/index', needLogin: true },
  { label: '联系客服', action: 'service' },
  { label: '关于我们', path: '/pages/profile/about/index' },
  { label: '设置', path: '/pages/profile/settings/index' },
]

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
    Taro.setBackgroundColor({ backgroundColor: '#ffffff' })
  }, [])

  const checkLogin = () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return false
    }
    return true
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.removeStorageSync('access_token')
          Taro.removeStorageSync('refresh_token')
          Taro.removeStorageSync('user_info')
          setUser(null)
          Taro.showToast({ title: '已退出登录', icon: 'none' })
        }
      }
    })
  }

  const goLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  const goOrders = (status?: string) => {
    if (!checkLogin()) return
    Taro.navigateTo({ url: `/pages/orders/list/index${status ? '?status=' + status : ''}` })
  }

  const handleMenu = (item: typeof MENU[number]) => {
    if (item.needLogin && !checkLogin()) return
    if (item.path) {
      Taro.navigateTo({ url: item.path })
    } else if (item.action === 'service') {
      setServiceVisible(true)
    }
  }

  return (
    <View className={`profile-page ${serviceVisible ? 'no-scroll' : ''}`}>
      <View className={`profile-top-section ${user ? '' : 'no-vip'}`}>
        <View className='profile-navbar'>
          <Image className='profile-navbar-logo' src={topLogo} mode='aspectFit' />
          <Text className='profile-navbar-title'>尾巴PetWay</Text>
        </View>

        <View className='profile-header' onClick={user ? undefined : goLogin}>
          <View className='profile-header-inner'>
            <View className='profile-avatar-wrap'>
              {user?.avatar ? (
                <Image className='profile-avatar' src={compressImageUrl(user.avatar, 200)} mode='aspectFill' />
              ) : (
                <Image className='profile-avatar' src={ICON_MAP['默认头像']} mode='aspectFill' />
              )}
            </View>
            <View className='profile-user-meta'>
              <View className='profile-name-row'>
                <Text className='profile-nickname'>{user ? (user.nickname || '尾巴人') : '点击登录/注册'}</Text>
                {user && (
                  <View className='profile-edit-btn' onClick={() => Taro.navigateTo({ url: '/pages/profile/edit/index' })}>
                    <Text className='profile-edit-text'>编辑资料</Text>
                  </View>
                )}
              </View>
              {!user && <Text className='profile-subtitle'>解锁更多宠友精彩内容</Text>}
            </View>
            {!user && (
              <View className='profile-header-arrow'>
                <Text className='profile-header-arrow-text'>›</Text>
              </View>
            )}
          </View>
        </View>

        {/* VIP 会员卡片 */}
        {user && (
          <View className='profile-vip-card' onClick={() => Taro.navigateTo({ url: '/pages/member/center/index' })}>
            <View className='profile-vip-header'>
              <View className='profile-vip-title'>
                <Text className='profile-vip-text'>VIP</Text>
                <Text className='profile-vip-subtitle'>会员</Text>
              </View>
              <View className='profile-vip-actions'>
                <View className='profile-vip-tag'>
                  <Text className='profile-vip-tag-text'>享专属优惠</Text>
                </View>
                <View className='profile-vip-btn'>
                  <Text className='profile-vip-btn-text'>立即开通</Text>
                  <Text className='profile-vip-btn-arrow'>›</Text>
                </View>
              </View>
            </View>
            <View className='profile-vip-body'>
              <View className='profile-vip-price-row'>
                <Text className='profile-vip-price'>
                  <Text className='profile-vip-price-currency'>¥</Text>9.9/年，开通年度会员
                </Text>
              </View>
              <View className='profile-vip-original-row'>
                <Text className='profile-vip-original'>¥99</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View className={`profile-order-card ${user ? '' : 'no-vip'}`}>
        <View className='profile-card-header'>
          <Text className='profile-card-title'>我的订单</Text>
          <View className='profile-card-more' onClick={() => goOrders()}>
            <Text className='profile-card-more-text'>全部</Text>
            <Text className='profile-card-more-arrow'>›</Text>
          </View>
        </View>
        <View className='profile-order-entries'>
          {ORDER_ENTRIES.map(e => (
            <View
              key={e.label}
              className='profile-order-entry'
              onClick={() => {
                if (e.action === 'refund') {
                  if (!checkLogin()) return
                  Taro.navigateTo({ url: '/pages/orders/list/index?status=refund' })
                } else if (e.status) {
                  goOrders(e.status)
                }
              }}
            >
              <Image className='profile-order-icon' src={ICON_MAP[e.label]} mode='aspectFit' />
              <Text className='profile-order-label'>{e.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='profile-menu-section'>
        <View className='profile-menu-card'>
          {MENU.map(item => (
            <View key={item.label} className='profile-menu-item' onClick={() => handleMenu(item)}>
              <Image className='profile-menu-icon' src={ICON_MAP[item.label]} mode='aspectFit' />
              <Text className='profile-menu-label'>{item.label}</Text>
              <Text className='profile-menu-arrow'>›</Text>
            </View>
          ))}
        </View>
        {user && (
          <View className='profile-logout-card' onClick={handleLogout}>
            <Text className='profile-logout-text'>退出登录</Text>
          </View>
        )}
      </View>

      {serviceVisible && (
        <View className='service-modal' catchMove>
          <View className='service-mask' onClick={() => setServiceVisible(false)} catchMove />
          <View className='service-content' catchMove>
            <Text className='service-title'>联系客服</Text>
            <Image
              className='qr-image'
              src={require('../../assets/images/customer-service.jpg')}
              mode='widthFix'
              showMenuByLongpress
              onError={() => Taro.showToast({ title: '图片加载失败', icon: 'none' })}
            />
            <Text className='qr-modal-tip'>长按二维码识别，添加客服</Text>
            <View className='qr-modal-close' onClick={() => setServiceVisible(false)}>
              <Text>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

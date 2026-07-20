import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
const logoIcon = '/assets/toplogo.png'
import { getUserProfile, setActiveTab, getMemberCenter, compressImageUrl } from '../../utils/api'
import './index.scss'

const ICON_MAP: Record<string, string> = {
  '默认头像': '/assets/icons/profile/head.png',
  '待支付': '/assets/icons/profile/pending.png',
  '待出行': '/assets/icons/profile/travel.png',
  '已完成': '/assets/icons/profile/completed.png',
  '退款/售后': '/assets/icons/profile/refund.png',
  '会员中心': '/assets/icons/profile/vip.png',
  '优惠券': '/assets/icons/profile/coupon.png',
  '出行人管理': '/assets/icons/profile/traveler.png',
  '领养记录': '/assets/icons/profile/adoption.png',
  '我的足迹': '/assets/icons/profile/footprint.png',
  '联系客服': '/assets/icons/profile/service.png',
  '关于我们': '/assets/icons/profile/about.png',
  '设置': '/assets/icons/profile/settings.png',
  '犬格测评': '/assets/icons/personality.svg',
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
  { label: '领养记录', path: '/pages/adoption/records/index', needLogin: true },
  { label: '犬格测评', path: '/pages/profile/dog-personality-records/index', needLogin: true },
  { label: '我的足迹', path: '/pages/profile/footprint/index', needLogin: true },
  { label: '联系客服', action: 'service' },
  { label: '关于我们', path: '/pages/profile/about/index' },
  { label: '设置', path: '/pages/profile/settings/index' },
]

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [serviceVisible, setServiceVisible] = useState(false)
  const [memberInfo, setMemberInfo] = useState<any>(null)

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

  const loadMemberInfo = async () => {
    try {
      const res = await getMemberCenter()
      const data = res.data || res
      setMemberInfo(data)
    } catch (e) {
      console.error('loadMemberInfo failed:', e)
    }
  }

  useDidShow(() => {
    setActiveTab(3, 'pages/profile/index')
    loadUser()
    const token = Taro.getStorageSync('access_token')
    if (token) {
      loadMemberInfo()
    } else {
      setMemberInfo(null)
    }
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
      {/* 浅绿色 header 背景 */}
      <View className='profile-header-bg'>
        {/* 顶部导航栏 */}
        <View className='custom-navbar'>
          <View className='navbar-bg' />
          <View className='navbar-content'>
            <View className='navbar-left'>
              <Image className='navbar-icon' src={logoIcon} mode='aspectFit' />
              <Text className='navbar-title'>尾巴PetWay</Text>
            </View>
          </View>
        </View>

        {/* 用户信息卡 */}
        <View className='user-header' onClick={user ? undefined : goLogin}>
          <View className='user-avatar-wrap'>
            {user?.avatar ? (
              <Image className='user-avatar' src={compressImageUrl(user.avatar, 200)} mode='aspectFill' />
            ) : (
              <Image className='user-avatar' src={ICON_MAP['默认头像']} mode='aspectFill' />
            )}
          </View>
          <View className='user-info'>
            {user ? (
              <>
                <Text className='user-nickname'>{user.nickname || '尾巴人'}</Text>
                <View className='user-edit-btn' onClick={(e) => { e.stopPropagation(); Taro.navigateTo({ url: '/pages/profile/edit/index' }) }}>
                  <Text className='user-edit-text'>编辑资料</Text>
                </View>
              </>
            ) : (
              <View className='login-wrap'>
                <Text className='login-text'>点击登录/注册</Text>
                <Text className='login-subtext'>解锁更多宠友精彩内容</Text>
              </View>
            )}
          </View>
          {!user && (
            <View className='login-arrow'>
              <Text className='login-arrow-text'>›</Text>
            </View>
          )}
        </View>
      </View>

      {/* 内容区 */}
      <View className='profile-content'>
        {/* VIP 会员入口 */}
        {user && (
          <View
            className='vip-card'
            onClick={() => Taro.navigateTo({ url: '/pages/member/center/index' })}
          >
            {memberInfo?.is_member || !!memberInfo?.member_info ? (
              <View className='vip-member-card'>
                <View className='vip-member-badge'>生效中</View>
                <View className='vip-member-main'>
                  <View className='vip-member-left'>
                    <Text className='vip-member-title'>尾巴PetWay会员</Text>
                    <Text className='vip-member-time'>购买时间：{memberInfo.member_info?.start_date?.split('T')[0] || '-'}</Text>
                  </View>
                  <View className='vip-member-right'>
                    <Text className='vip-member-icon'>VIP</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className='vip-not-member'>
                <View className='vip-not-top'>
                  <View className='vip-title-wrap'>
                    <Text className='vip-big-title'>VIP</Text>
                    <Text className='vip-subtitle'>会员</Text>
                  </View>
                  <View className='vip-tags'>
                    <Text className='vip-tag'>享专属优惠</Text>
                    <Text className='vip-tag vip-tag-primary'>立即开通 ›</Text>
                  </View>
                </View>
                <View className='vip-promo'>
                  <Text className='vip-promo-price'>¥9.9/年，开通年度会员</Text>
                  <Text className='vip-promo-original'>¥99</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 我的订单 */}
        <View className='order-card'>
          <View className='order-header'>
            <Text className='order-title'>我的订单</Text>
            <View className='order-more' onClick={() => goOrders()}>
              <Text className='order-more-text'>全部 ›</Text>
            </View>
          </View>
          <View className='order-entries'>
            {ORDER_ENTRIES.map(e => (
              <View
                key={e.label}
                className='order-entry'
                onClick={() => {
                  if (e.action === 'refund') {
                    if (!checkLogin()) return
                    Taro.navigateTo({ url: '/pages/orders/list/index?status=refund' })
                  } else if (e.status) {
                    goOrders(e.status)
                  }
                }}
              >
                <View className='order-icon-wrap'>
                  <Image className='order-icon-img' src={ICON_MAP[e.label]} mode='aspectFit' />
                </View>
                <Text className='order-label'>{e.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 菜单列表 */}
        <View className='menu-card'>
          {MENU.map((item, idx) => (
            <View
              key={item.label}
              className={`menu-item ${idx === MENU.length - 1 ? 'menu-item-last' : ''}`}
              onClick={() => handleMenu(item)}
            >
              <View className='menu-icon-wrap'>
                <Image className='menu-icon-img' src={ICON_MAP[item.label]} mode='aspectFit' />
              </View>
              <Text className='menu-label'>{item.label}</Text>
              <Text className='menu-arrow'>›</Text>
            </View>
          ))}
        </View>

        {/* 退出登录 */}
        {user && (
          <View className='logout-section'>
            <View className='logout-btn' onClick={handleLogout}>
              <Text className='logout-text'>退出登录</Text>
            </View>
          </View>
        )}
      </View>

      {/* 客服弹窗 */}
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

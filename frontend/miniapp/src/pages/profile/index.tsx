import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
const logoIcon = '/assets/toplogo.png'
import { getUserProfile, setActiveTab, getMemberCenter, getUserCoupons } from '../../utils/api'
import './index.scss'

const ICON_MAP: Record<string, string> = {
  '优惠券': '/assets/icons/profile/coupon.png',
  '收藏夹': '/assets/icons/profile/favorite.png',
  '浏览足迹': '/assets/icons/profile/footprint.png',
  '地址管理': '/assets/icons/profile/address.png',
  '出行人管理': '/assets/icons/profile/traveler.png',
  '我的足迹': '/assets/icons/profile/footprint.png',
  '联系客服': '/assets/icons/profile/service.png',
  '关于我们': '/assets/icons/profile/about.png',
  '设置': '/assets/icons/profile/settings.png',
  '待支付': '/assets/icons/profile/pending.png',
  '待出行': '/assets/icons/profile/travel.png',
  '待评价': '/assets/icons/profile/review.png',
  '退款/售后': '/assets/icons/profile/refund.png',
  '默认头像': '/assets/icons/profile/default-avatar.png',
}

const SERVICES = [
  { label: '优惠券', path: '/pages/coupons/list/index' },
  { label: '收藏夹', count: 12 },
  { label: '浏览足迹' },
  { label: '地址管理' },
]

const MORE = [
  { label: '会员中心', path: '/pages/member/center/index' },
  { label: '优惠券', path: '/pages/coupons/list/index' },
  { label: '出行人管理', path: '/pages/profile/travelers/index' },
  { label: '我的足迹', path: '/pages/profile/footprint/index' },
  { label: '联系客服', action: 'service' },
  { label: '关于我们', path: '/pages/profile/about/index' },
  { label: '设置', path: '/pages/profile/settings/index' },
]

const ORDER_ENTRIES = [
  { label: '待支付', status: '10' },
  { label: '待出行', status: '20' },
  { label: '退款/售后', action: 'refund' },
]

const showDeveloping = () => {
  Taro.showToast({ title: '功能开发中', icon: 'none' })
}

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [serviceVisible, setServiceVisible] = useState(false)
  const [memberInfo, setMemberInfo] = useState<any>(null)
  const [couponCount, setCouponCount] = useState(0)

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
      console.log('getMemberCenter response:', res)
      // 兼容两种返回结构：{ code, data } 或 { is_member, member_info, ... }
      const data = res.data || res
      setMemberInfo(data)
    } catch (e) {
      console.error('loadMemberInfo failed:', e)
    }
  }

  const loadCouponCount = async () => {
    try {
      const res = await getUserCoupons({ status: 1, page_size: 1 })
      if (res.code === 200) {
        setCouponCount(res.data?.total || 0)
      }
    } catch (e) {
      // ignore
    }
  }

  useDidShow(() => {
    setActiveTab(3, 'pages/profile/index')
    loadUser()
    loadMemberInfo()
    loadCouponCount()
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
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='navbar-left'>
            <Image className='navbar-icon' src={logoIcon} mode='aspectFit' />
            <Text className='navbar-title'>尾巴旅行</Text>
          </View>
        </View>
      </View>
      <View className='user-header'>
        <View className='user-top'>
          {user?.avatar ? (
            <Image className='avatar' src={user.avatar} mode='aspectFill' style={{ width: '120rpx', height: '120rpx' }} />
          ) : (
            <View className='avatar avatar-placeholder'>
              <Image className='avatar-icon-img' src={ICON_MAP['默认头像']} mode='aspectFit' />
            </View>
          )}
          <View className='user-info'>
            {user ? (
              <>
                <Text className='nickname'>{user.nickname || '宠友'}</Text>
              </>
            ) : (
              <View className='login-wrap' onClick={goLogin}>
                <Text className='login-text'>点击登录/注册</Text>
                <Text className='login-subtext'>解锁更多宠友旅行精彩内容</Text>
              </View>
            )}
          </View>
          {!user && (
            <View className='login-arrow' onClick={goLogin}>
              <Text className='login-arrow-text'>›</Text>
            </View>
          )}
        </View>
        {user && (
          <View className='user-actions'>
            <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/profile/edit/index' })}>
              <Text className='action-btn-text'>编辑资料</Text>
            </View>
            <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/notifications/list/index' })}>
              <Text className='action-btn-text'>消息通知</Text>
            </View>
          </View>
        )}
      </View>

      {/* 会员入口 */}
      {user && (
        <View 
          className='vip-card'
          onClick={() => Taro.navigateTo({ url: '/pages/member/center/index' })}
        >
          {memberInfo?.is_member || !!memberInfo?.member_info ? (
            <View className='vip-member-card'>
              <Text className='vip-member-badge'>生效中</Text>
              <View className='vip-member-main'>
                <View className='vip-member-left'>
                  <Text className='vip-member-title'>尾巴旅行会员</Text>
                  <Text className='vip-member-time'>购买时间：{memberInfo.member_info?.start_date?.split('T')[0] || '-'}</Text>
                </View>
                <View className='vip-member-right'>
                  <Text className='vip-member-icon'>VIP</Text>
                </View>
              </View>
            </View>
          ) : (
            <>
              {/* 上半部分 */}
              <View className='vip-card-top'>
                <View className='vip-title-wrap'>
                  <Text className='vip-title'>VIP</Text>
                  <Text className='vip-subtitle'>会员</Text>
                </View>
                <View className='vip-tags'>
                  <Text className='vip-tag'>享专属优惠</Text>
                  <Text className='vip-tag vip-tag-primary'>立即开通 ›</Text>
                </View>
              </View>
              {/* 下半部分 */}
              <View className='vip-card-bottom'>
                <View className='vip-icons'>
                  <View className='vip-icon-item'>
                    <Text className='vip-icon-text'>%</Text>
                  </View>
                  <View className='vip-icon-item'>
                    <Text className='vip-icon-text'>⚡</Text>
                  </View>
                  <View className='vip-icon-item'>
                    <Text className='vip-icon-text'>¥</Text>
                  </View>
                </View>
                <View className='vip-desc'>
                  <Text className='vip-desc-price'>¥39.9/年，开通年度会员</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      <View className='card'>
        <View className='card-header'>
          <Text className='card-title'>我的订单</Text>
          <View className='card-more' onClick={() => goOrders()}>
            <Text className='card-more-text'>全部 {'>'}</Text>
          </View>
        </View>
        <View className='order-entries'>
          {ORDER_ENTRIES.map(e => (
            <View
              key={e.label}
              className='entry'
              onClick={() => {
                if (e.action === 'refund') {
                  if (!checkLogin()) return
                  Taro.navigateTo({ url: '/pages/orders/list/index?status=refund' })
                } else if (e.status) {
                  goOrders(e.status)
                }
              }}
            >
              <Image className='entry-icon-img' src={ICON_MAP[e.label]} mode='aspectFit' />
              <Text className='entry-label'>{e.label}</Text>
            </View>
          ))}
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
              <Image className='more-icon-img' src={ICON_MAP[m.label]} mode='aspectFit' />
              <Text className='more-label'>{m.label}</Text>
              <Text className='more-arrow'>{'>'}</Text>
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

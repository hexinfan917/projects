import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text , Image } from '@tarojs/components'
import { getUserCoupons, safeNavigateBack } from '../../../utils/api'
import './index.scss'

const STATUS_TABS = [
  { label: '未使用', value: 1 },
  { label: '已使用', value: 2 },
  { label: '已过期', value: 3 },
]

const TYPE_TEXT: Record<number, string> = { 1: '满减券', 2: '折扣券', 3: '立减券', 4: '礼品券' }

export default function CouponList() {
  const [tab, setTab] = useState(1)
  const [list, setList] = useState<any[]>([])

  useDidShow(() => {
    loadData()
  })

  const loadData = async () => {
    try {
      const res = await getUserCoupons({ status: tab })
      if (res.code === 200) {
        setList(res.data?.list || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [tab])

  return (
    <View className='coupon-list-page'>
      <View className='custom-navbar'>
        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='navbar-title'>我的优惠券</Text>

      </View>

      <View className='tab-bar'>
        {STATUS_TABS.map(t => (
          <View
            key={t.value}
            className={`tab-item ${tab === t.value ? 'active' : ''}`}
            onClick={() => setTab(t.value)}
          >
            <Text className='tab-text'>{t.label}</Text>
          </View>
        ))}
      </View>

      <View className='coupon-notice'>
        <Text className='coupon-notice-text'>💡 优惠券仅减免活动价格，保险/选配不参与优惠</Text>
      </View>

      <View className='coupon-list'>
        {list.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-text'>暂无{couponStatusText(tab)}优惠券</Text>
          </View>
        )}
        {list.map((item: any) => (
          <View
            key={item.id}
            className={`coupon-card ${item.status !== 1 ? 'disabled' : ''}`}
            onClick={() => {
              if (item.type === 4) {
                Taro.navigateTo({
                  url: `/pages/coupons/detail/index?data=${encodeURIComponent(JSON.stringify(item))}`
                })
              }
            }}
          >
            <View className='coupon-left'>
              {item.type === 4 ? (
                <>
                  <Text className='coupon-gift-icon'>🎁</Text>
                  <Text className='coupon-type'>{TYPE_TEXT[item.type] || '优惠券'}</Text>
                </>
              ) : (
                <>
                  <View className='coupon-value-row'>
                    {item.type !== 2 && <Text className='coupon-value-unit'>¥</Text>}
                    <Text className='coupon-value'>{item.type === 2 ? `${item.value}` : item.value}</Text>
                    {item.type === 2 && <Text className='coupon-value-unit'>折</Text>}
                  </View>
                  <Text className='coupon-type'>{TYPE_TEXT[item.type] || '优惠券'}</Text>
                </>
              )}
            </View>
            <View className='coupon-divider'>
              <View className='coupon-notch top' />
              <View className='coupon-notch bottom' />
            </View>
            <View className='coupon-right'>
              <View className='coupon-info'>
                <View className='coupon-name-row'>
                  <Text className='coupon-name'>{item.name}</Text>
                  {item.is_expired_soon && item.type !== 4 && (
                    <Text className='expire-soon'>即将过期</Text>
                  )}
                </View>
                <Text className='coupon-desc'>
                  {item.type === 4
                    ? (item.description || '点击查看详情')
                    : (item.min_amount > 0 ? `满${item.min_amount}元可用` : '无门槛')
                  }
                </Text>
                {item.description && item.type !== 4 && (
                  <Text className='coupon-desc-detail'>{item.description}</Text>
                )}
                <Text className='coupon-valid'>有效期至 {formatDate(item.valid_end_time)}</Text>
                {item.coupon_no && item.type !== 4 && (
                  <Text className='coupon-no'>券码: {item.coupon_no}</Text>
                )}
              </View>
              <View className='coupon-right-bottom'>
                {item.type !== 4 && <Text className='coupon-tag'>不可退</Text>}
                {item.status === 1 && (
                  <View className='use-btn' onClick={(e) => {
                    e.stopPropagation()
                    // 跳转到路线列表（活动页面）
                    Taro.switchTab({ url: '/pages/routes/index' })
                  }}>
                    <Text className='use-btn-text'>去使用</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function couponStatusText(status: number) {
  return STATUS_TABS.find(t => t.value === status)?.label || ''
}

function formatDate(dt: string) {
  if (!dt) return '-'
  return dt.split('T')[0]
}

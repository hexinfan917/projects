import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getUserCoupons } from '../../../utils/api'
import './index.scss'

const STATUS_TABS = [
  { label: '未使用', value: 1 },
  { label: '已使用', value: 2 },
  { label: '已过期', value: 3 },
]

const TYPE_TEXT: Record<number, string> = { 1: '满减券', 2: '折扣券', 3: '立减券' }

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
        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
        <Text className='navbar-title'>我的优惠券</Text>
        <View className='nav-right' onClick={() => Taro.navigateTo({ url: '/pages/coupons/center/index' })}>
          <Text className='nav-right-text'>去领券</Text>
        </View>
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

      <View className='coupon-list'>
        {list.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-text'>暂无{couponStatusText(tab)}优惠券</Text>
          </View>
        )}
        {list.map((item: any) => (
          <View key={item.id} className={`coupon-card ${item.status !== 1 ? 'disabled' : ''}`}>
            <View className='coupon-left'>
              <Text className='coupon-value'>
                {item.type === 2 ? `${item.value}折` : `¥${item.value}`}
              </Text>
              <Text className='coupon-type'>{TYPE_TEXT[item.type] || '优惠券'}</Text>
            </View>
            <View className='coupon-right'>
              <Text className='coupon-name'>{item.name}</Text>
              <Text className='coupon-desc'>
                {item.min_amount > 0 ? `满${item.min_amount}元可用` : '无门槛'}
              </Text>
              <Text className='coupon-valid'>有效期至 {formatDate(item.valid_end_time)}</Text>
              {item.is_expired_soon && (
                <Text className='expire-soon'>即将过期</Text>
              )}
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

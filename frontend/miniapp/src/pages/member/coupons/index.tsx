import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text , Image } from '@tarojs/components'
import { getMemberCoupons, safeNavigateBack } from '../../../utils/api'
import './index.scss'

const STATUS_TABS = [
  { label: '未使用', value: 1 },
  { label: '已使用', value: 2 },
  { label: '已过期', value: 3 },
]

const TYPE_TEXT: Record<number, string> = { 1: '满减券', 2: '折扣券', 3: '立减券', 4: '礼品券' }

export default function MemberCoupons() {
  const [tab, setTab] = useState(1)
  const [list, setList] = useState<any[]>([])
  const [totalValue, setTotalValue] = useState(0)

  useDidShow(() => {
    loadData()
  })

  const loadData = async () => {
    try {
      const res = await getMemberCoupons({ status: tab })
      if (res.code === 200) {
        setList(res.data?.list || [])
        setTotalValue(res.data?.total_value || 0)
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
        <Text className='navbar-title'>我的消费券</Text>
      </View>

      {tab === 1 && (
        <View className='total-value-bar'>
          <Text className='total-value-text'>券包总价值：¥{totalValue}</Text>
        </View>
      )}

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
            <Text className='empty-text'>暂无{couponStatusText(tab)}消费券</Text>
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
                <Text className='coupon-name'>{item.name}</Text>
                <Text className='coupon-desc'>
                  {item.type === 4
                    ? (item.description || '点击查看详情')
                    : (item.min_amount > 0 ? `满${item.min_amount}元可用` : '无门槛')
                  }
                </Text>
                <Text className='coupon-valid'>有效期至 {formatDate(item.valid_end_time)}</Text>
              </View>
              <View className='coupon-right-bottom'>
                {item.type !== 4 && <Text className='coupon-tag'>不可退</Text>}
                {item.status === 1 && (
                  <View className='use-btn'>
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

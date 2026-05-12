import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getClaimCenter, claimCoupon } from '../../../utils/api'
import './index.scss'

export default function CouponCenter() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useDidShow(() => {
    loadData()
  })

  const loadData = async () => {
    try {
      const res = await getClaimCenter()
      if (res.code === 200) {
        setList(res.data?.list || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleClaim = async (templateId: number) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await claimCoupon(templateId)
      if (res.code === 200) {
        Taro.showToast({ title: '领取成功', icon: 'success' })
        loadData()
      } else {
        Taro.showToast({ title: res.message || '领取失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e.message || '领取失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='coupon-center-page'>
      <View className='custom-navbar'>
        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
        <Text className='navbar-title'>领券中心</Text>
      </View>

      <View className='coupon-list'>
        {list.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-text'>暂无可领取优惠券</Text>
          </View>
        )}
        {list.map((item: any) => (
          <View key={item.template_id} className='coupon-card'>
            <View className='coupon-left'>
              <Text className='coupon-value'>
                {item.type === 2 ? `${item.value}折` : `¥${item.value}`}
              </Text>
              <Text className='coupon-condition'>
                {item.min_amount > 0 ? `满${item.min_amount}可用` : '无门槛'}
              </Text>
            </View>
            <View className='coupon-right'>
              <Text className='coupon-name'>{item.name}</Text>
              <Text className='coupon-desc'>{item.description}</Text>
              <Text className='coupon-stock'>
                {item.remaining_count !== null
                  ? `已领${item.claimed_count}/${item.total_count}`
                  : `已领${item.claimed_count}`}
              </Text>
              {item.can_claim ? (
                <View className='claim-btn' onClick={() => handleClaim(item.template_id)}>
                  <Text className='claim-btn-text'>立即领取</Text>
                </View>
              ) : (
                <View className='claim-btn disabled'>
                  <Text className='claim-btn-text'>{item.cannot_claim_reason || '已领完'}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

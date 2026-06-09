import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text , Image } from '@tarojs/components'
import { useCoupon, safeNavigateBack } from '../../../utils/api'
import './index.scss'

const TYPE_TEXT: Record<number, string> = { 1: '满减券', 2: '折扣券', 3: '立减券', 4: '礼品券' }
const STATUS_TEXT: Record<number, string> = { 1: '未使用', 2: '已使用', 3: '已过期', 4: '已作废' }

export default function CouponDetail() {
  const router = useRouter()
  const [coupon, setCoupon] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const data = router.params.data
    if (data) {
      try {
        setCoupon(JSON.parse(decodeURIComponent(data)))
      } catch (e) {
        console.error(e)
      }
    }
  }, [router.params.data])

  const handleUse = async () => {
    if (!coupon || coupon.type !== 4) return
    Taro.showModal({
      title: '确认使用',
      content: `确认使用「${coupon.name}」吗？使用后不可恢复。`,
      confirmColor: '#22C55E',
      success: async (res) => {
        if (res.confirm) {
          setLoading(true)
          try {
            const result = await useCoupon(coupon.id)
            if (result.code === 200) {
              Taro.showToast({ title: '核销成功', icon: 'success' })
              setCoupon({ ...coupon, status: 2, status_text: '已使用', used_at: result.data?.used_at })
              // 通知上一页刷新
              Taro.eventCenter.trigger('coupon_used', { id: coupon.id })
            } else {
              Taro.showToast({ title: result.message || '核销失败', icon: 'none' })
            }
          } catch (e: any) {
            Taro.showToast({ title: e.message || '核销失败', icon: 'none' })
          } finally {
            setLoading(false)
          }
        }
      }
    })
  }

  if (!coupon) {
    return (
      <View className='coupon-detail-page'>
        <View className='custom-navbar'>
          <View className='page-back' onClick={() => safeNavigateBack()}>
            <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
          </View>
          <Text className='navbar-title'>券详情</Text>
        </View>
        <View className='empty-state'>
          <Text className='empty-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  const isGift = coupon.type === 4
  const isUsable = coupon.status === 1

  return (
    <View className='coupon-detail-page'>
      <View className='custom-navbar'>
        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='navbar-title'>券详情</Text>
      </View>

      <View className='coupon-card'>
        <View className={`coupon-header ${!isUsable ? 'disabled' : ''}`}>
          <View className='coupon-type-tag'>{TYPE_TEXT[coupon.type] || '优惠券'}</View>
          <Text className='coupon-name'>{coupon.name}</Text>
          {isGift ? (
            <Text className='coupon-value gift'>礼品券</Text>
          ) : (
            <Text className='coupon-value'>
              {coupon.type === 2 ? `${coupon.value}折` : `¥${coupon.value}`}
            </Text>
          )}
        </View>

        <View className='coupon-body'>
          <View className='info-row'>
            <Text className='info-label'>状态</Text>
            <Text className={`info-value status-${coupon.status}`}>{STATUS_TEXT[coupon.status] || '未知'}</Text>
          </View>
          <View className='info-row'>
            <Text className='info-label'>券码</Text>
            <Text className='info-value'>{coupon.coupon_no}</Text>
          </View>
          {!isGift && (
            <View className='info-row'>
              <Text className='info-label'>使用门槛</Text>
              <Text className='info-value'>{coupon.min_amount > 0 ? `满${coupon.min_amount}元可用` : '无门槛'}</Text>
            </View>
          )}
          <View className='info-row'>
            <Text className='info-label'>有效期</Text>
            <Text className='info-value'>{formatDate(coupon.valid_start_time)} 至 {formatDate(coupon.valid_end_time)}</Text>
          </View>
          {coupon.used_at && (
            <View className='info-row'>
              <Text className='info-label'>使用时间</Text>
              <Text className='info-value'>{formatDateTime(coupon.used_at)}</Text>
            </View>
          )}
        </View>

        {coupon.description && (
          <View className='coupon-desc-box'>
            <Text className='desc-title'>使用说明</Text>
            <Text className='desc-content'>{coupon.description}</Text>
          </View>
        )}
      </View>

      {isGift && isUsable && (
        <View className='action-bar'>
          <View className={`use-btn ${loading ? 'loading' : ''}`} onClick={handleUse}>
            <Text className='btn-text'>{loading ? '处理中...' : '确认使用'}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

function formatDate(dt: string) {
  if (!dt) return '-'
  return dt.split('T')[0]
}

function formatDateTime(dt: string) {
  if (!dt) return '-'
  return dt.replace('T', ' ').substring(0, 19)
}

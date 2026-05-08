import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button, Textarea } from '@tarojs/components'
import { getOrderDetail, refundOrder } from '../../../utils/api'
import './index.scss'

const REASON_OPTIONS = [
  { value: '行程有变，无法出行', label: '行程有变，无法出行' },
  { value: '重复下单', label: '重复下单' },
  { value: '天气原因', label: '天气原因' },
  { value: '宠物身体不适', label: '宠物身体不适' },
  { value: '其他原因', label: '其他原因' },
]

export default function RefundPage() {
  const [order, setOrder] = useState<any>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadOrder(Number(id))
    }
  }, [])

  const loadOrder = async (id: number) => {
    const res = await getOrderDetail(id)
    setOrder(res.data)
  }

  const handleSubmit = async () => {
    const reason = selectedReason === '其他原因' ? otherReason : selectedReason
    if (!reason.trim()) {
      Taro.showToast({ title: '请选择或填写退款原因', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      await refundOrder(order.id, { reason })
      Taro.showToast({ title: '退款申请已提交', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (err) {
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (!order) {
    return (
      <View className='refund-page' style={{ paddingTop: '140rpx' }}>
        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
        <Text className='loading-text'>加载中...</Text>
      </View>
    )
  }

  return (
    <View className='refund-page' style={{ paddingTop: '140rpx' }}>
      <View className='page-back' onClick={() => Taro.navigateBack()}>
        <Text className='page-back-icon'>←</Text>
      </View>

      <View className='refund-header'>
        <Text className='refund-title'>申请退款</Text>
      </View>

      {(order.refund_reject_reason || order.status === 45) && (
        <View className='info-card reject-card'>
          <Text className='card-title reject-title'>退款申请未通过</Text>
          <Text className='reject-reason'>原因：{order.refund_reject_reason || '不符合退款条件'}</Text>
          <Text className='reject-tip'>您可修改原因后重新提交申请</Text>
        </View>
      )}

      <View className='info-card'>
        <Text className='route-name'>{order.route_name}</Text>
        <Text className='info-row'>出行日期: {order.travel_date}</Text>
        <Text className='info-row'>实付金额: ￥{order.pay_amount}</Text>
      </View>

      <View className='info-card'>
        <Text className='card-title'>退款金额</Text>
        <Text className='refund-amount'>￥{order.pay_amount}</Text>
        <Text className='refund-tip'>申请退款后，款项将原路退回至您的支付账户</Text>
      </View>

      <View className='info-card'>
        <Text className='card-title'>退款原因</Text>
        <View className='reason-list'>
          {REASON_OPTIONS.map((item) => (
            <View
              key={item.value}
              className={`reason-item ${selectedReason === item.value ? 'active' : ''}`}
              onClick={() => setSelectedReason(item.value)}
            >
              <Text className='reason-text'>{item.label}</Text>
              <View className={`radio ${selectedReason === item.value ? 'checked' : ''}`} />
            </View>
          ))}
        </View>
        {selectedReason === '其他原因' && (
          <Textarea
            className='reason-textarea'
            placeholder='请填写具体退款原因'
            value={otherReason}
            onInput={(e) => setOtherReason(e.detail.value)}
            maxlength={200}
          />
        )}
      </View>

      <View className='submit-bar'>
        <Button
          className={`btn-submit ${loading ? 'disabled' : ''}`}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '提交中...' : '提交退款申请'}
        </Button>
      </View>
    </View>
  )
}

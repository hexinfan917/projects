import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Button, Image, ScrollView } from '@tarojs/components'
import { getOrderDetail, cancelOrder, refundOrder } from '../../../utils/api'
import './index.scss'

const STATUS_MAP: any = {
  10: '待支付',
  20: '待出行',
  30: '已取消',
  40: '退款中',
  45: '退款驳回',
  50: '已退款',
  60: '待评价',
  70: '已评价'
}

export default function OrderDetail() {
  const [order, setOrder] = useState<any>(null)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadOrder(Number(id))
    }
  }, [])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadOrder(Number(id))
    }
  })

  const loadOrder = async (id: number) => {
    const res = await getOrderDetail(id)
    setOrder(res.data)
  }

  const onRefresh = async () => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (!id) return
    setRefreshing(true)
    try {
      await loadOrder(Number(id))
    } finally {
      setRefreshing(false)
    }
  }

  const handleCancel = async () => {
    try {
      await cancelOrder(order.id)
      Taro.showToast({ title: '取消成功', icon: 'success' })
      loadOrder(order.id)
    } catch (err) {
      Taro.showToast({ title: '取消失败', icon: 'none' })
    }
  }

  const goRefund = () => {
    Taro.navigateTo({ url: `/pages/orders/refund/index?id=${order.id}` })
  }

  if (!order) return <View className='order-detail'><Text>加载中...</Text></View>

  return (
    <View className='order-detail' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <ScrollView className='detail-scroll' scrollY refresherEnabled refresherTriggered={refreshing} onRefresherRefresh={onRefresh}>
      <View className='status-bar'>
        <Text className='status-text'>{STATUS_MAP[order.status] || '未知'}</Text>
      </View>

      {order.refund_reject_reason && order.status === 45 && (
        <View className='info-card reject-card'>
          <Text className='card-title reject-title'>退款申请未通过</Text>
          <Text className='reject-reason'>原因：{order.refund_reject_reason}</Text>
          <Text className='reject-tip'>您可点击"重新申请"再次提交</Text>
        </View>
      )}

      <View className='info-card'>
        <Text className='route-name'>{order.route_name}</Text>
        <Text className='info-row'>出行日期: {order.travel_date}</Text>
        <Text className='info-row'>成人: {order.participant_count}人 | 宠物: {order.pet_count}只</Text>
      </View>

      {(order.contact?.name || (order.participants && order.participants.length > 0) || (order.pets && order.pets.length > 0)) && (
        <View className='info-card'>
          <Text className='card-title'>出行人与宠物</Text>
          {order.contact?.name && (
            <View className='participant-row'>
              <Text className='participant-label'>联系人</Text>
              <Text className='participant-value'>{order.contact.name} {order.contact.phone}</Text>
            </View>
          )}
          {order.participants && order.participants.map((p: any, idx: number) => (
            <View key={idx} className='participant-row'>
              <Text className='participant-label'>出行人{idx + 1}</Text>
              <Text className='participant-value'>{p.name} {p.phone}</Text>
            </View>
          ))}
          {order.pets && order.pets.map((pet: any, idx: number) => (
            <View key={`pet-${idx}`} className='participant-row'>
              <Text className='participant-label'>宠物{idx + 1}</Text>
              <Text className='participant-value'>{pet.name} {pet.breed ? `(${pet.breed})` : ''}</Text>
            </View>
          ))}
        </View>
      )}

      <View className='info-card'>
        <Text className='card-title'>费用明细</Text>
        <Text className='info-row'>路线费用: ￥{order.route_price}</Text>
        <Text className='info-row'>保险费用: ￥{order.insurance_price}</Text>
        <Text className='info-row'>优惠金额: -￥{order.discount_amount}</Text>
        <View className='divider' />
        <Text className='total-row'>实付金额: ￥{order.pay_amount}</Text>
      </View>
      </ScrollView>

      <View className='action-bar'>
        {order.status === 10 && (
          <View className='action-btns'>
            <Button className='btn-default' onClick={handleCancel}>取消订单</Button>
            <Button className='btn-primary' onClick={() => Taro.navigateTo({ url: `/pages/orders/pay/index?id=${order.id}` })}>去支付</Button>
          </View>
        )}
        {order.status === 20 && (
          <View className='action-btns'>
            <Button className='btn-default' onClick={() => setQrModalVisible(true)}>联系客服</Button>
            <Button className='btn-default' onClick={goRefund}>申请退款</Button>
          </View>
        )}
        {order.status === 45 && (
          <View className='action-btns'>
            <Button className='btn-default' onClick={() => setQrModalVisible(true)}>联系客服</Button>
            <Button className='btn-default' onClick={goRefund}>重新申请</Button>
          </View>
        )}
        {(order.status === 40 || order.status === 50) && (
          <View className='action-btns'>
            <Button className='btn-default' onClick={() => setQrModalVisible(true)}>联系客服</Button>
          </View>
        )}
        {order.status === 60 && (
          <Button className='btn-primary' onClick={() => Taro.navigateTo({ url: `/pages/orders/evaluate/index?id=${order.id}` })}>评价</Button>
        )}
      </View>

      {qrModalVisible && (
        <View className='qr-modal' onClick={() => setQrModalVisible(false)}>
          <View className='qr-modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='qr-modal-title'>联系客服</Text>
            <Image
              className='qr-image'
              src={require('../../../assets/images/customer-service.jpg')}
              mode='widthFix'
              onError={() => Taro.showToast({ title: '图片加载失败', icon: 'none' })}
            />
            <Text className='qr-modal-tip'>长按二维码识别，添加客服微信</Text>
            <View className='qr-modal-close' onClick={() => setQrModalVisible(false)}>
              <Text>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { getOrderDetail, cancelOrder } from '../../../utils/api'
import './index.scss'

const STATUS_MAP: any = {
  10: '待支付',
  20: '已支付',
  30: '已取消',
  40: '退款中',
  50: '已退款',
  60: '已完成',
  70: '已评价'
}

export default function OrderDetail() {
  const [order, setOrder] = useState<any>(null)

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

  const handleCancel = async () => {
    try {
      await cancelOrder(order.id)
      Taro.showToast({ title: '取消成功', icon: 'success' })
      loadOrder(order.id)
    } catch (err) {
      Taro.showToast({ title: '取消失败', icon: 'none' })
    }
  }

  if (!order) return <View className='order-detail'><Text>加载中...</Text></View>

  return (
    <View className='order-detail'>
      <View className='status-bar'>
        <Text className='status-text'>{STATUS_MAP[order.status] || '未知'}</Text>
      </View>

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

      <View className='action-bar'>
        {order.status === 10 && (
          <View className='action-btns'>
            <Button className='btn-default' onClick={handleCancel}>取消订单</Button>
            <Button className='btn-primary' onClick={() => Taro.navigateTo({ url: `/pages/orders/pay/index?id=${order.id}` })}>去支付</Button>
          </View>
        )}
        {order.status === 60 && (
          <Button className='btn-primary' onClick={() => Taro.navigateTo({ url: `/pages/orders/evaluate/index?id=${order.id}` })}>评价</Button>
        )}
      </View>
    </View>
  )
}

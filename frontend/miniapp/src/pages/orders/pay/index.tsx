import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { getOrderDetail, payOrder } from '../../../utils/api'
import './index.scss'

export default function OrderPay() {
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      getOrderDetail(Number(id)).then(res => setOrder(res.data))
    }
  }, [])

  const handlePay = async () => {
    try {
      await payOrder(order.id)
      Taro.showToast({ title: '支付成功', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/orders/list/index' })
      }, 1000)
    } catch (err) {
      Taro.showToast({ title: '支付失败', icon: 'none' })
    }
  }

  if (!order) return <View className='order-pay'><Text>加载中...</Text></View>

  return (
    <View className='order-pay' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='pay-card'>
        <Text className='pay-title'>订单支付</Text>
        <Text className='pay-amount'>￥{order.pay_amount}</Text>
        <Text className='pay-order-no'>订单号: {order.order_no}</Text>
      </View>

      <View className='pay-method'>
        <Text className='method-title'>支付方式</Text>
        <View className='method-item active'>
          <Text>微信支付</Text>
          <Text className='check-icon'>✓</Text>
        </View>
      </View>

      <Button className='pay-btn' onClick={handlePay}>确认支付 ￥{order.pay_amount}</Button>
    </View>
  )
}

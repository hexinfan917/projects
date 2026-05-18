import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button , Image } from '@tarojs/components'
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
      Taro.showLoading({ title: '正在发起支付...' })
      const res: any = await payOrder(order.id)
      Taro.hideLoading()

      const payData = res.data
      if (!payData || !payData.pay_params) {
        Taro.showToast({ title: '获取支付参数失败', icon: 'none' })
        return
      }

      // Mock 模式直接跳过真实支付（未配置微信支付时）
      if (payData.mock) {
        Taro.showToast({ title: '模拟支付成功', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/orders/list/index' })
        }, 1000)
        return
      }

      const params = payData.pay_params

      // 调用微信支付
      Taro.requestPayment({
        timeStamp: params.timeStamp,
        nonceStr: params.nonceStr,
        package: params.package,
        signType: params.signType || 'MD5',
        paySign: params.paySign,
        success: () => {
          Taro.showToast({ title: '支付成功', icon: 'success' })
          setTimeout(() => {
            Taro.redirectTo({ url: '/pages/orders/list/index' })
          }, 1000)
        },
        fail: (err: any) => {
          console.error('支付失败:', err)
          const isCancel = err.errMsg?.includes('cancel')
          Taro.showToast({ title: isCancel ? '已取消支付' : '支付失败', icon: 'none' })
          setTimeout(() => {
            Taro.redirectTo({ url: `/pages/orders/list/index?status=${isCancel ? '10' : 'all'}` })
          }, 1000)
        }
      })
    } catch (err: any) {
      Taro.hideLoading()
      console.error('支付请求失败:', err)
      Taro.showToast({ title: err.message || '支付失败', icon: 'none' })
    }
  }

  if (!order) return <View className='order-pay'><Text>加载中...</Text></View>

  return (
    <View className='order-pay' style={{ paddingTop: '140rpx' }}>
      <View className='page-back' onClick={() => Taro.navigateBack()}>
        <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
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

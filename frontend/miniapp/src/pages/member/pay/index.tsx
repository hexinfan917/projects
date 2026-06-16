import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text , Image } from '@tarojs/components'
import { getMemberPlans, createMemberOrder, payMemberOrder, safeNavigateBack } from '../../../utils/api'
import './index.scss'

export default function MemberPay() {
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const [planId, setPlanId] = useState<number | null>(null)

  useEffect(() => {
    const router = Taro.getCurrentInstance().router
    const id = router?.params?.planId ? parseInt(router.params.planId) : null
    if (id) {
      setPlanId(id)
    }
  }, [])

  useEffect(() => {
    if (planId) {
      loadPlan()
    }
  }, [planId])

  const loadPlan = async () => {
    if (!planId) {
      Taro.showToast({ title: '套餐信息缺失', icon: 'none' })
      return
    }
    try {
      const res = await getMemberPlans()
      if (res.code === 200) {
        const list = res.data?.list || res.data || []
        const p = list.find((item: any) => String(item.id) === String(planId))
        if (p) {
          setPlan(p)
        } else {
          Taro.showToast({ title: '套餐不存在', icon: 'none' })
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handlePay = async () => {
    if (!planId || loading) return
    setLoading(true)
    try {
      let platform = 'unknown'
      try {
        if (typeof wx !== 'undefined' && wx.getDeviceInfo) {
          const deviceInfo = wx.getDeviceInfo()
          platform = deviceInfo.platform === 'ios' ? 'ios' : (deviceInfo.platform === 'android' ? 'android' : deviceInfo.platform)
        }
      } catch (e) {
        console.log('[MemberPay] getDeviceInfo failed')
      }
      const orderRes = await createMemberOrder(planId, platform)
      if (orderRes.code !== 200) {
        Taro.showToast({ title: orderRes.message || '创建订单失败', icon: 'none' })
        setLoading(false)
        return
      }
      const orderId = orderRes.data.order_id

      const payRes = await payMemberOrder(orderId)
      if (payRes.code !== 200) {
        Taro.showToast({ title: payRes.message || '支付下单失败', icon: 'none' })
        setLoading(false)
        return
      }

      const payData = payRes.data
      if (!payData) {
        Taro.showToast({ title: '获取支付参数失败', icon: 'none' })
        setLoading(false)
        return
      }

      // Mock 模式直接跳过真实支付（未配置微信支付时）
      if (payData.mock) {
        Taro.showToast({ title: '模拟支付成功', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/member/center/index?payment_success=1' })
        }, 1200)
        setLoading(false)
        return
      }

      const payParams = payData.pay_params
      if (!payParams || !payParams.timeStamp) {
        Taro.showToast({ title: '支付参数缺失', icon: 'none' })
        setLoading(false)
        return
      }

      // 调用微信支付（iOS和安卓统一）
      Taro.requestPayment({
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType || 'MD5',
        paySign: payParams.paySign,
        success: () => {
          Taro.showToast({ title: '支付成功', icon: 'success' })
          setTimeout(() => {
            Taro.redirectTo({ url: '/pages/member/center/index?payment_success=1' })
          }, 1200)
        },
        fail: (err: any) => {
          console.error('支付失败:', err)
          const isCancel = err.errMsg?.includes('cancel')
          Taro.showToast({ title: isCancel ? '已取消支付' : '支付失败', icon: 'none' })
        },
        complete: () => {
          setLoading(false)
        }
      })
    } catch (e: any) {
      Taro.showToast({ title: e.message || '请求失败', icon: 'none' })
      setLoading(false)
    }
  }

  const handleBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length <= 1) {
      Taro.switchTab({ url: '/pages/index/index' })
    } else {
      safeNavigateBack()
    }
  }

  return (
    <View className='member-pay-page'>
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='page-back' onClick={handleBack}>
            <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
          </View>
          <Text className='navbar-title'>确认订单</Text>
        </View>
      </View>

      <View className='pay-content'>
        <View className='plan-info-card'>
          <Text className='plan-info-name'>{plan?.name || '会员套餐'}</Text>
          <Text className='plan-info-duration'>{plan?.duration_days || 365}天有效期</Text>
          <View className='plan-info-price-row'>
            <Text className='plan-info-price'>¥{plan?.sale_price || '--'}</Text>
            {plan?.original_price > plan?.sale_price && (
              <Text className='plan-info-original'>¥{plan?.original_price}</Text>
            )}
          </View>
        </View>

        {plan?.benefits && plan.benefits.length > 0 && (
          <View className='pay-section'>
            <Text className='pay-section-title'>包含权益</Text>
            <View className='pay-benefit-list'>
              {plan.benefits.map((b: any, idx: number) => (
                <View key={idx} className='pay-benefit-item'>
                  <Text className='pay-benefit-icon'>✓</Text>
                  <Text className='pay-benefit-text'>{b.title}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className='pay-section'>
          <Text className='pay-section-title'>支付方式</Text>
          <View className='pay-method-row'>
            <Text className='pay-method-icon'>💳</Text>
            <Text className='pay-method-name'>微信支付</Text>
            <View className='pay-method-check checked' />
          </View>
        </View>
      </View>

      <View className='pay-bottom-bar'>
        <View className='pay-bottom-price-wrap'>
          <Text className='pay-bottom-label'>实付金额</Text>
          <Text className='pay-bottom-price'>¥{plan?.sale_price || '--'}</Text>
        </View>
        <View className={`pay-bottom-btn ${loading ? 'disabled' : ''}`} onClick={handlePay}>
          {loading ? '支付中...' : '确认支付'}
        </View>
      </View>
    </View>
  )
}

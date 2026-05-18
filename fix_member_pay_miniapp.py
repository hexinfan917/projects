import re

with open("/opt/petway/frontend/miniapp/src/pages/member/pay/index.tsx", "r") as f:
    content = f.read()

old_handle_pay = '''  const handlePay = async () => {
    if (!planId || loading) return
    setLoading(true)
    try {
      const orderRes = await createMemberOrder(planId)
      if (orderRes.code !== 200) {
        Taro.showToast({ title: orderRes.message || '创建订单失败', icon: 'none' })
        setLoading(false)
        return
      }
      const orderId = orderRes.data.order_id

      const payRes = await payMemberOrder(orderId)
      if (payRes.code === 200) {
        Taro.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/member/center/index?payment_success=1' })
        }, 1200)
      } else {
        Taro.showToast({ title: payRes.message || '支付失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e.message || '请求失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }'''

new_handle_pay = '''  const handlePay = async () => {
    if (!planId || loading) return
    setLoading(true)
    try {
      const orderRes = await createMemberOrder(planId)
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

      const payData = payRes.data || {}
      const payParams = payData.pay_params

      if (payData.mock) {
        Taro.showToast({ title: '模拟支付成功', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/member/center/index?payment_success=1' })
        }, 1200)
        setLoading(false)
        return
      }

      const paymentRes: any = await Taro.requestPayment({
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType,
        paySign: payParams.paySign,
      })

      if (paymentRes.errMsg === 'requestPayment:ok') {
        Taro.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/member/center/index?payment_success=1' })
        }, 1200)
      } else {
        Taro.showToast({ title: '支付取消', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e.message || '请求失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }'''

content = content.replace(old_handle_pay, new_handle_pay)

with open("/opt/petway/frontend/miniapp/src/pages/member/pay/index.tsx", "w") as f:
    f.write(content)

print("Done")

import { useEffect, useState, useRef, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { getOrders, cancelOrder } from '../../../utils/api'
import './index.scss'

const TABS = [
  { key: 'all', label: '全部' },
  { key: '10', label: '待支付' },
  { key: '20', label: '待出行' },
  { key: 'refund', label: '退款/售后' },
]

const STATUS_MAP: any = {
  10: '待支付',
  20: '待出行',
  30: '已取消',
  40: '退款中',
  45: '退款驳回',
  50: '已退款'
}

const COUNTDOWN_24H = 24 * 60 * 60 * 1000

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function OrderList() {
  const [activeTab, setActiveTab] = useState('all')
  const [orders, setOrders] = useState<any[]>([])
  const [now, setNow] = useState(Date.now())
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const requestIdRef = useRef(0)

  const loadOrders = useCallback(async (tabKey: string) => {
    const currentRequestId = ++requestIdRef.current
    try {
      if (tabKey === 'refund') {
        const [res1, res2, res3] = await Promise.all([
          getOrders({ status: 40 }),
          getOrders({ status: 45 }),
          getOrders({ status: 50 })
        ])
        const list = [...(res1.data?.orders || []), ...(res2.data?.orders || []), ...(res3.data?.orders || [])]
        if (currentRequestId === requestIdRef.current) {
          setOrders(list)
        }
        return
      }

      const params: any = {}
      if (tabKey !== 'all') params.status = Number(tabKey)
      const res = await getOrders(params)
      if (currentRequestId !== requestIdRef.current) return
      const list = res.data?.orders || []
      // 自动取消已超时且仍为待支付的订单（前端兜底）
      for (const o of list) {
        if (o.status === 10 && o.created_at) {
          const expireAt = new Date(o.created_at).getTime() + COUNTDOWN_24H
          if (Date.now() >= expireAt) {
            try { await cancelOrder(o.id) } catch {}
          }
        }
      }
      // 如果执行了取消，重新拉取
      const needReload = list.some((o: any) => o.status === 10 && o.created_at && Date.now() >= new Date(o.created_at).getTime() + COUNTDOWN_24H)
      if (needReload) {
        const res2 = await getOrders(params)
        if (currentRequestId === requestIdRef.current) {
          setOrders(res2.data?.orders || [])
        }
      } else {
        if (currentRequestId === requestIdRef.current) {
          setOrders(list)
        }
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  }, [])

  useDidShow(() => {
    loadOrders(activeTab)
  })

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const status = instance.router?.params?.status
    if (status) {
      setActiveTab(status)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadOrders(activeTab)
  }, [activeTab])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await loadOrders(activeTab)
    } finally {
      setRefreshing(false)
    }
  }

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/orders/detail/index?id=${id}` })
  }

  const goPay = (id: number, e: any) => {
    e && e.stopPropagation()
    Taro.navigateTo({ url: `/pages/orders/pay/index?id=${id}` })
  }

  const goRefund = (id: number) => {
    Taro.navigateTo({ url: `/pages/orders/refund/index?id=${id}` })
  }

  const handleCancel = async (id: number, e: any) => {
    e && e.stopPropagation()
    try {
      await cancelOrder(id)
      Taro.showToast({ title: '取消成功', icon: 'success' })
      loadOrders(activeTab)
    } catch {
      Taro.showToast({ title: '取消失败', icon: 'none' })
    }
  }

  const showCustomerService = (e: any) => {
    e && e.stopPropagation()
    setQrModalVisible(true)
  }

  const getCountdown = (createdAt: string) => {
    const end = new Date(createdAt).getTime() + COUNTDOWN_24H
    return Math.max(0, end - now)
  }

  return (
    <View className='order-list' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='tabs'>
        {TABS.map(tab => (
          <View
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView className='list-scroll' scrollY refresherEnabled refresherTriggered={refreshing} onRefresherRefresh={onRefresh}>
        {orders.map(order => {
          const countdown = order.status === 10 && order.created_at ? getCountdown(order.created_at) : 0
          return (
            <View key={order.id} className='order-card' onClick={() => goDetail(order.id)}>
              <View className='order-header'>
                <Text className='order-no'>订单号: {order.order_no}</Text>
                <Text className='order-status'>{STATUS_MAP[order.status]}</Text>
              </View>
              <View className='order-body'>
                <Text className='route-name'>{order.route_name}</Text>
                <Text className='order-info'>{order.travel_date} · {order.participant_count}人{order.pet_count}宠</Text>
              </View>
              <View className='order-footer'>
                <View>
                  <Text className='order-price'>￥{order.pay_amount}</Text>
                  {order.status === 10 && countdown > 0 && (
                    <Text className='countdown-text'>剩余 {formatCountdown(countdown)}</Text>
                  )}
                </View>
                {order.status === 10 && countdown > 0 && (
                  <View className='action-btns'>
                    <View className='mini-btn default' onClick={(e) => handleCancel(order.id, e)}>
                      <Text>取消订单</Text>
                    </View>
                    <View className='mini-btn primary' onClick={(e) => goPay(order.id, e)}>
                      <Text>去支付</Text>
                    </View>
                  </View>
                )}
                {order.status === 20 && (
                  <View className='action-btns'>
                    <View className='mini-btn default' onClick={(e) => showCustomerService(e)}>
                      <Text>联系客服</Text>
                    </View>
                    <View className='mini-btn default' onClick={() => goRefund(order.id)}>
                      <Text>申请退款</Text>
                    </View>
                  </View>
                )}
                {order.status === 45 && (
                  <View className='action-btns'>
                    <View className='mini-btn default' onClick={(e) => showCustomerService(e)}>
                      <Text>联系客服</Text>
                    </View>
                    <View className='mini-btn default' onClick={() => goRefund(order.id)}>
                      <Text>重新申请</Text>
                    </View>
                  </View>
                )}
                {(order.status === 40 || order.status === 50) && (
                  <View className='action-btns'>
                    <View className='mini-btn default' onClick={(e) => showCustomerService(e)}>
                      <Text>联系客服</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )
        })}
        {orders.length === 0 && <Text className='empty-tip'>暂无订单</Text>}
      </ScrollView>

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

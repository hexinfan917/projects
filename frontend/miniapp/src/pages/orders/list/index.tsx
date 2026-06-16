import { useEffect, useState, useRef, useCallback } from 'react'
import Taro, { useDidShow, useUnload } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { getOrders, cancelOrder, safeNavigateBack, compressImageUrl } from '../../../utils/api'
import './index.scss'

const TABS = [
  { key: 'all', label: '全部' },
  { key: '10', label: '待支付' },
  { key: '20', label: '待出行' },
  { key: 'completed', label: '已完成' },
  { key: 'refund', label: '退款/售后' },
]

const STATUS_MAP: any = {
  10: '待支付',
  20: '待出行',
  30: '已取消',
  40: '退款中',
  45: '退款驳回',
  50: '已退款',
  55: '部分退款',
  60: '已完成',
  70: '已评价'
}

const STATUS_CLASS: any = {
  10: 'pay',
  20: 'trip',
  30: 'disabled',
  40: 'refund',
  45: 'refund',
  50: 'refund',
  55: 'refund',
  60: 'disabled',
  70: 'disabled'
}

const STATUS_ICON: any = {
  10: '/assets/icons/icon-order-pay.svg',
  20: '/assets/icons/icon-order-trip.svg',
  30: '/assets/icons/icon-order-complete.svg',
  40: '/assets/icons/icon-order-refund.svg',
  45: '/assets/icons/icon-order-refund.svg',
  50: '/assets/icons/icon-order-refund.svg',
  55: '/assets/icons/icon-order-refund.svg',
  60: '/assets/icons/icon-order-complete.svg',
  70: '/assets/icons/icon-order-complete.svg'
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
  const [statusBarHeight, setStatusBarHeight] = useState(40)
  const [windowHeight, setWindowHeight] = useState(667)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const sysInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(sysInfo.statusBarHeight || 40)
    setWindowHeight(sysInfo.windowHeight || 667)
  }, [])

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

      if (tabKey === 'completed') {
        const [res1, res2] = await Promise.all([
          getOrders({ status: 60 }),
          getOrders({ status: 70 }),
        ])
        const list = [...(res1.data?.orders || []), ...(res2.data?.orders || [])]
        list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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

  useUnload(() => {
    const instance = Taro.getCurrentInstance()
    const from = instance.router?.params?.from
    if (from === 'pay') {
      Taro.switchTab({ url: '/pages/profile/index' })
    }
  })

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

  const goEvaluate = (id: number, e: any) => {
    e && e.stopPropagation()
    Taro.navigateTo({ url: `/pages/orders/evaluate/index?id=${id}` })
  }

  const goRouteDetail = (routeId: number) => {
    if (routeId) {
      Taro.navigateTo({ url: `/pages/routes/detail/index?id=${routeId}` })
    }
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

  const topHeightPx = statusBarHeight + 96
  const topHeightRpx = topHeightPx * 2
  const scrollHeightPx = windowHeight - topHeightPx

  const onBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length <= 1) {
      const instance = Taro.getCurrentInstance()
      const from = instance.router?.params?.from
      if (from === 'pay') {
        Taro.switchTab({ url: '/pages/profile/index' })
      } else {
        Taro.switchTab({ url: '/pages/index/index' })
      }
    } else {
      safeNavigateBack()
    }
  }

  const renderActions = (order: any) => {
    const status = order.status
    if (status === 10) {
      const countdown = order.created_at ? getCountdown(order.created_at) : 0
      if (countdown <= 0) return null
      return (
        <View className='action-btns'>
          <View className='mini-btn default' onClick={(e) => handleCancel(order.id, e)}>
            <Text>取消订单</Text>
          </View>
          <View className='mini-btn primary' onClick={(e) => goPay(order.id, e)}>
            <Text>立即支付</Text>
          </View>
        </View>
      )
    }
    if (status === 20) {
      return (
        <View className='action-btns'>
          <View className='mini-btn default' onClick={(e) => handleCancel(order.id, e)}>
            <Text>取消订单</Text>
          </View>
          <View className='mini-btn default' onClick={(e) => showCustomerService(e)}>
            <Text>联系客服</Text>
          </View>
        </View>
      )
    }
    if (status === 45) {
      return (
        <View className='action-btns'>
          <View className='mini-btn default' onClick={(e) => showCustomerService(e)}>
            <Text>联系客服</Text>
          </View>
          {order.pay_amount > 0 && (
            <View className='mini-btn default' onClick={() => goRefund(order.id)}>
              <Text>重新申请</Text>
            </View>
          )}
        </View>
      )
    }
    if (status === 40 || status === 50 || status === 55) {
      return (
        <View className='action-btns'>
          <View className='mini-btn default' onClick={(e) => showCustomerService(e)}>
            <Text>联系客服</Text>
          </View>
        </View>
      )
    }
    if (status === 60) {
      return (
        <View className='action-btns'>
          <View className='mini-btn default' onClick={(e) => { e.stopPropagation(); goRouteDetail(order.route_id) }}>
            <Text>再来一单</Text>
          </View>
          <View className='mini-btn primary' onClick={(e) => goEvaluate(order.id, e)}>
            <Text>评价活动</Text>
          </View>
        </View>
      )
    }
    return (
      <View className='action-btns'>
        <View className='mini-btn default' onClick={(e) => showCustomerService(e)}>
          <Text>联系客服</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='order-list' style={{ paddingTop: `${topHeightRpx}rpx` }}>
      <View
        className='top-section'
        style={{
          paddingTop: `${statusBarHeight}px`,
          height: `${topHeightRpx}rpx`,
          boxSizing: 'border-box'
        }}
      >
        <View className='header-inner'>
          <View className='header-left' onClick={onBack}>
            <Image className='back-icon' src='/assets/icons/return.png' mode='aspectFit' />
          </View>
          <Text className='header-title'>我的订单</Text>
          <View className='header-right' />
        </View>

        <View className='tabs'>
          {TABS.map(tab => (
            <View
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Text className='tab-text'>{tab.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        className='list-scroll'
        style={{ height: `${scrollHeightPx}px` }}
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        <View className='list-content'>
          {orders.map(order => (
            <View key={order.id} className='order-card' onClick={() => goDetail(order.id)}>
              <View className='order-header'>
                <View className='order-no-wrap' onClick={(e) => { e.stopPropagation(); Taro.setClipboardData({ data: order.order_no }) }}>
                  <Image className='order-icon' src={STATUS_ICON[order.status] || '/assets/icons/icon-order-complete.svg'} mode='aspectFit' />
                  <Text className='order-no'>订单号: {order.order_no}</Text>
                  <Text className='copy-icon'>复制</Text>
                </View>
                <Text className={`order-status status-${STATUS_CLASS[order.status] || 'disabled'}`}>
                  {STATUS_MAP[order.status]}
                </Text>
              </View>

              <View className='order-body'>
                {order.route_cover ? (
                  <Image
                    className='route-cover'
                    src={compressImageUrl(order.route_cover, 200)}
                    mode='aspectFill'
                  />
                ) : (
                  <View className='route-cover route-cover-placeholder' />
                )}
                <View className='order-body-main'>
                  <Text className='route-name'>{order.route_name}</Text>
                  <View className='order-info'>
                    <View className='info-item'>
                      <Image className='info-icon-svg' src='/assets/icons/icon-calendar.svg' mode='aspectFit' />
                      <Text className='info-text'>{order.travel_date}</Text>
                    </View>
                    <View className='info-item'>
                      <Image className='info-icon-svg' src='/assets/icons/icon-people.svg' mode='aspectFit' />
                      <Text className='info-text'>{order.participant_count}人{order.pet_count}宠</Text>
                    </View>
                  </View>
                </View>
                <View className='order-price-wrap'>
                  <Text className='order-price'>¥{order.pay_amount}</Text>
                </View>
              </View>

              <View className='order-footer'>
                {renderActions(order)}
              </View>
            </View>
          ))}
          {orders.length === 0 && <Text className='empty-tip'>暂无订单</Text>}
        </View>
      </ScrollView>

      {qrModalVisible && (
        <View className='qr-modal' onClick={() => setQrModalVisible(false)}>
          <View className='qr-modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='qr-modal-title'>联系客服</Text>
            <Image
              className='qr-image'
              src={require('../../../assets/images/customer-service.jpg')}
              mode='widthFix'
              showMenuByLongpress
              onError={() => Taro.showToast({ title: '图片加载失败', icon: 'none' })}
            />
            <Text className='qr-modal-tip'>长按二维码识别，添加客服</Text>
            <View className='qr-modal-close' onClick={() => setQrModalVisible(false)}>
              <Text>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

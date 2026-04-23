import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../../utils/api'
import './index.scss'

export default function NotificationList() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useDidShow(() => {
    setPage(1)
    setHasMore(true)
    loadNotifications(1, true)
  })

  const loadNotifications = async (targetPage: number = 1, reset: boolean = false) => {
    if (loading) return
    try {
      setLoading(true)
      const res = await getNotifications({ page: targetPage, page_size: 20 })
      if (res.code === 200 && res.data?.notifications) {
        const list = res.data.notifications
        if (reset) {
          setNotifications(list)
        } else {
          setNotifications(prev => [...prev, ...list])
        }
        setHasMore(list.length === 20)
        setUnreadCount(res.data.unread_count || 0)
      } else {
        if (reset) setNotifications([])
        setHasMore(false)
      }
    } catch (error) {
      console.error('Load notifications failed:', error)
      if (reset) setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!hasMore || loading) return
    const nextPage = page + 1
    setPage(nextPage)
    loadNotifications(nextPage, false)
  }

  const handleRead = async (id: number) => {
    try {
      await markNotificationRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Mark read failed:', error)
    }
  }

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
      Taro.showToast({ title: '已全部标记已读', icon: 'success' })
    } catch (error) {
      console.error('Mark all read failed:', error)
    }
  }

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = { system: '系统', order: '订单', route: '路线' }
    return map[type] || '通知'
  }

  return (
    <View className='notification-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='notification-header'>
        <Text className='header-title'>消息通知</Text>
        {unreadCount > 0 && (
          <Text className='read-all-btn' onClick={handleReadAll}>全部已读</Text>
        )}
      </View>

      <ScrollView
        className='notification-list'
        scrollY
        lowerThreshold={100}
        onScrollToLower={loadMore}
      >
        {notifications.length === 0 && !loading && (
          <View className='empty-tip'>
            <Text>暂无通知</Text>
          </View>
        )}
        {notifications.map(n => (
          <View
            key={n.id}
            className={`notification-card ${n.is_read ? 'read' : 'unread'}`}
            onClick={() => handleRead(n.id)}
          >
            <View className='notification-top'>
              <Text className='notification-type'>{getTypeLabel(n.notify_type)}</Text>
              <Text className='notification-time'>{n.created_at?.slice(0, 10) || ''}</Text>
            </View>
            <Text className='notification-title'>{n.title}</Text>
            <Text className='notification-content'>{n.content}</Text>
          </View>
        ))}
        {loading && <Text className='loading-text'>加载中...</Text>}
        {!hasMore && notifications.length > 0 && <Text className='loading-text'>没有更多了</Text>}
      </ScrollView>
    </View>
  )
}

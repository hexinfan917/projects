import { useEffect, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { getMyAdoptionApplications, safeNavigateBack, IMAGE_BASE_URL } from '../../../utils/api'
import './index.scss'

const STATUS_TABS = [
  { key: 'all', label: '全部', status: undefined },
  { key: 'pending', label: '待审核', status: 0 },
  { key: 'approved', label: '已通过', status: 1 },
  { key: 'rejected', label: '已拒绝', status: 2 },
  { key: 'completed', label: '已完成', status: 3 },
]

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '待审核', color: '#f59e0b' },
  1: { label: '已通过', color: '#22c55e' },
  2: { label: '已拒绝', color: '#ef4444' },
  3: { label: '已完成', color: '#436444' },
}

export default function AdoptionRecords() {
  const [activeTab, setActiveTab] = useState('all')
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useDidShow(() => {
    loadRecords(1, true)
  })

  usePullDownRefresh(() => {
    loadRecords(1, true)
  })

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    // 直接根据 key 加载，避免 state 异步更新问题
    const tab = STATUS_TABS.find(t => t.key === key)
    loadRecordsWithTab(1, true, tab)
  }

  const loadRecordsWithTab = async (pageNum: number = 1, reset: boolean = false, tab?: typeof STATUS_TABS[0]) => {
    if (loading) return
    setLoading(true)
    try {
      const params: any = { page: pageNum, page_size: 10 }
      if (tab?.status !== undefined) {
        params.status = tab.status
      }
      const res = await getMyAdoptionApplications(params)
      if (res.code === 200 && res.data) {
        const apps = res.data.applications || []
        const total = res.data.total || 0
        if (reset) {
          setRecords(apps)
        } else {
          setRecords(prev => [...prev, ...apps])
        }
        setHasMore(apps.length === 10)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('加载领养记录失败', error)
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  const loadRecords = async (pageNum: number = 1, reset: boolean = false) => {
    if (loading) return
    setLoading(true)
    try {
      const currentTab = STATUS_TABS.find(t => t.key === activeTab)
      const params: any = { page: pageNum, page_size: 10 }
      if (currentTab?.status !== undefined) {
        params.status = currentTab.status
      }
      const res = await getMyAdoptionApplications(params)
      if (res.code === 200 && res.data) {
        const apps = res.data.applications || []
        const total = res.data.total || 0
        if (reset) {
          setRecords(apps)
        } else {
          setRecords(prev => [...prev, ...apps])
        }
        setHasMore(apps.length === 10)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('加载领养记录失败', error)
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  const handleLoadMore = () => {
    if (!hasMore || loading) return
    loadRecords(page + 1, false)
  }

  const handleNavigateToDetail = (dogId: number) => {
    Taro.navigateTo({ url: `/pages/adoption/detail/index?id=${dogId}` })
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  return (
    <View className='adoption-records-page'>
      {/* 顶部导航 */}
      <View className='records-navbar'>
        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Text className='page-back-icon'>‹</Text>
        </View>
        <Text className='navbar-title'>领养记录</Text>
        <View className='navbar-spacer' />
      </View>

      {/* 状态筛选 Tab */}
      <View className='records-tabs'>
        <ScrollView className='tabs-scroll' scrollX showScrollbar={false}>
          {STATUS_TABS.map((tab) => (
            <View
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              <Text className='tab-text'>{tab.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 记录列表 */}
      <ScrollView
        className='records-list'
        scrollY
        onScrollToLower={handleLoadMore}
        refresherEnabled
        onRefresherRefresh={() => loadRecords(1, true)}
      >
        {records.length === 0 && !loading ? (
          <View className='records-empty'>
            <Text className='empty-icon'>🐕</Text>
            <Text className='empty-text'>暂无领养记录</Text>
            <Text className='empty-tip'>去狗狗领养页面看看吧</Text>
          </View>
        ) : (
          <>
            {records.map((record: any) => {
              const dog = record.dog || {}
              const statusConfig = STATUS_MAP[record.status] || { label: '未知', color: '#999' }
              const coverImage = dog.cover_image
                ? (dog.cover_image.startsWith('http') ? dog.cover_image : `${IMAGE_BASE_URL}${dog.cover_image}`)
                : ''
              return (
                <View
                  key={record.id}
                  className='record-card'
                  onClick={() => handleNavigateToDetail(dog.id)}
                >
                  <Image className='record-dog-image' src={coverImage} mode='aspectFill' />
                  <View className='record-info'>
                    <View className='record-header'>
                      <Text className='record-dog-name'>{dog.name || '未知'}</Text>
                      <View className='record-status' style={{ backgroundColor: `${statusConfig.color}15` }}>
                        <Text className='record-status-text' style={{ color: statusConfig.color }}>
                          {statusConfig.label}
                        </Text>
                      </View>
                    </View>
                    <Text className='record-breed'>{dog.breed || ''}</Text>
                    <Text className='record-date'>申请时间：{formatDate(record.created_at)}</Text>
                  </View>
                  <Text className='record-arrow'>›</Text>
                </View>
              )
            })}
            {loading && (
              <View className='records-loading'>
                <Text className='loading-text'>加载中...</Text>
              </View>
            )}
            {!hasMore && records.length > 0 && (
              <View className='records-no-more'>
                <Text className='no-more-text'>没有更多了</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { useState } from 'react'
import { getDogPersonalityResultList, getDogPersonalityPkRecordList, getImageUrl } from '@/utils/api'
import CustomNavBar from '@/components/CustomNavBar'
import './index.scss'

const defaultAvatar = '/assets/images/placeholder-avatar.png'

const TYPE_CODE_COLOR = '#8b5000'

type TabType = 'test' | 'pk'

export default function DogPersonalityRecords() {
  const [activeTab, setActiveTab] = useState<TabType>('test')
  const [records, setRecords] = useState<any[]>([])
  const [pkRecords, setPkRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pkPage, setPkPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [pkHasMore, setPkHasMore] = useState(true)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [pkInitialLoaded, setPkInitialLoaded] = useState(false)

  const loadRecords = async (pageNum: number, refresh = false) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await getDogPersonalityResultList(pageNum, 20)
      const list = res.data?.list || []
      const total = res.data?.total || 0
      if (refresh) {
        setRecords(list)
      } else {
        setRecords((prev) => [...prev, ...list])
      }
      setHasMore((refresh ? list.length : records.length + list.length) < total)
      setPage(pageNum)
    } catch (err) {
      console.error('加载测评记录失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      setInitialLoaded(true)
      if (refresh) {
        Taro.stopPullDownRefresh()
      }
    }
  }

  const loadPkRecords = async (pageNum: number, refresh = false) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await getDogPersonalityPkRecordList(pageNum, 20)
      const list = res.data?.list || []
      const total = res.data?.total || 0
      if (refresh) {
        setPkRecords(list)
      } else {
        setPkRecords((prev) => [...prev, ...list])
      }
      setPkHasMore((refresh ? list.length : pkRecords.length + list.length) < total)
      setPkPage(pageNum)
    } catch (err) {
      console.error('加载 PK 记录失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      setPkInitialLoaded(true)
      if (refresh) {
        Taro.stopPullDownRefresh()
      }
    }
  }

  useDidShow(() => {
    loadRecords(1, true)
    loadPkRecords(1, true)
  })

  usePullDownRefresh(() => {
    if (activeTab === 'test') {
      loadRecords(1, true)
    } else {
      loadPkRecords(1, true)
    }
  })

  useReachBottom(() => {
    if (activeTab === 'test' && hasMore && !loading) {
      loadRecords(page + 1, false)
    } else if (activeTab === 'pk' && pkHasMore && !loading) {
      loadPkRecords(pkPage + 1, false)
    }
  })

  const switchTab = (tab: TabType) => {
    setActiveTab(tab)
    Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-'
    const date = new Date(timeStr)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}`
  }

  const handleViewDetail = (id: number) => {
    Taro.navigateTo({ url: `/subpackage/dog-personality/result/index?id=${id}` })
  }

  const handleViewPkDetail = (record: any) => {
    Taro.navigateTo({
      url: `/subpackage/dog-personality/pk/result/index?a=${record.a_result_id}&b=${record.b_result_id}`,
    })
  }

  return (
    <View className='dp-records-page'>
      <CustomNavBar title='犬格测评记录' backgroundColor='#FAF9F6' color='#1a4d2e' />

      <View className='dp-records-header'>
        <Text className='dp-records-title'>测评历史</Text>
        <Text className='dp-records-subtitle'>查看您所有宠物的性格测评与 PK 记录</Text>
      </View>

      <View className='dp-records-tabs'>
        <View
          className={`dp-records-tab ${activeTab === 'test' ? 'active' : ''}`}
          onClick={() => switchTab('test')}
        >
          <Text className='dp-records-tab-text'>测评记录</Text>
        </View>
        <View
          className={`dp-records-tab ${activeTab === 'pk' ? 'active' : ''}`}
          onClick={() => switchTab('pk')}
        >
          <Text className='dp-records-tab-text'>PK 记录</Text>
        </View>
      </View>

      {activeTab === 'test' ? (
        initialLoaded && records.length === 0 ? (
          <View className='dp-records-empty'>
            <Text className='dp-records-empty-text'>暂无测评记录</Text>
            <Text className='dp-records-empty-subtext'>完成一次犬格测评后，记录将显示在这里</Text>
          </View>
        ) : (
          <View className='dp-records-list'>
            {records.map((record) => {
              return (
                <View
                  key={record.id}
                  className='dp-record-card'
                  onClick={() => handleViewDetail(record.id)}
                >
                  <Image
                    className='dp-record-avatar'
                    src={record.pet_avatar ? getImageUrl(record.pet_avatar) : defaultAvatar}
                    mode='aspectFill'
                  />
                  <View className='dp-record-info'>
                    <Text className='dp-record-name'>{record.pet_name || '未命名宠物'}</Text>
                    <Text className='dp-record-time'>{formatTime(record.created_at)}</Text>
                  </View>
                  <View className='dp-record-score-wrap'>
                    <Text className='dp-record-type-code' style={{ color: TYPE_CODE_COLOR }}>
                      {record.type_code}
                    </Text>
                    <Text className='dp-record-type-title' style={{ color: TYPE_CODE_COLOR }}>
                      {record.title || '未知犬格'}
                    </Text>
                  </View>
                </View>
              )
            })}
            {loading && page > 1 && (
              <Text className='dp-records-loading'>加载中...</Text>
            )}
            {!hasMore && records.length > 0 && (
              <Text className='dp-records-no-more'>没有更多了</Text>
            )}
          </View>
        )
      ) : (
        pkInitialLoaded && pkRecords.length === 0 ? (
          <View className='dp-records-empty'>
            <Text className='dp-records-empty-text'>暂无 PK 记录</Text>
            <Text className='dp-records-empty-subtext'>参与一次犬格 PK 后，记录将显示在这里</Text>
          </View>
        ) : (
          <View className='dp-records-list'>
            {pkRecords.map((record) => (
              <View
                key={record.id}
                className='dp-pk-record-card'
                onClick={() => handleViewPkDetail(record)}
              >
                <View className='dp-pk-record-avatars'>
                  <Image
                    className='dp-pk-record-avatar dp-pk-record-avatar-a'
                    src={record.a_pet_avatar ? getImageUrl(record.a_pet_avatar) : defaultAvatar}
                    mode='aspectFill'
                  />
                  <Image
                    className='dp-pk-record-avatar dp-pk-record-avatar-b'
                    src={record.b_pet_avatar ? getImageUrl(record.b_pet_avatar) : defaultAvatar}
                    mode='aspectFill'
                  />
                  <View className='dp-pk-record-vs'>VS</View>
                </View>
                <View className='dp-pk-record-info'>
                  <Text className='dp-pk-record-names'>
                    {record.a_pet_name || '未命名'} vs {record.b_pet_name || '未命名'}
                  </Text>
                  <Text className='dp-pk-record-types'>
                    {record.a_type_code || '-'} · {record.b_type_code || '-'}
                  </Text>
                  <Text className='dp-pk-record-time'>{formatTime(record.created_at)}</Text>
                </View>
                <View className='dp-pk-record-result'>
                  <Text className='dp-pk-record-scores'>
                    {record.a_total_score} : {record.b_total_score}
                  </Text>
                  <Text
                    className='dp-pk-record-status'
                    style={{
                      color:
                        record.winner_side === 'tie'
                          ? '#6b7280'
                          : record.winner_side === record.my_side
                          ? '#22c55e'
                          : '#ef4444',
                    }}
                  >
                    {record.winner_side === 'tie'
                      ? '平局'
                      : record.winner_side === record.my_side
                      ? '胜利'
                      : '惜败'}
                  </Text>
                </View>
              </View>
            ))}
            {loading && pkPage > 1 && (
              <Text className='dp-records-loading'>加载中...</Text>
            )}
            {!pkHasMore && pkRecords.length > 0 && (
              <Text className='dp-records-no-more'>没有更多了</Text>
            )}
          </View>
        )
      )}
    </View>
  )
}

import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { getCharityActivities } from '../../../utils/api'
import './index.scss'

export default function CharityList() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    loadList(1)
  }, [])

  const loadList = async (p: number) => {
    if (loading) return
    try {
      setLoading(true)
      const res = await getCharityActivities({ page: p, page_size: 10, status: 1 })
      if (res.code === 200 && res.data?.activities) {
        const items = res.data.activities.map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.start_date || '',
          location: a.location || '',
          status: a.status_name || '报名中',
          image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) : '',
        }))
        if (p === 1) {
          setList(items)
        } else {
          setList(prev => [...prev, ...items])
        }
        setHasMore(items.length === 10)
        setPage(p)
      }
    } catch (error) {
      console.error('Load charity list failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/charities/detail/index?id=${id}` })
  }

  const onScrollToLower = () => {
    if (hasMore && !loading) {
      loadList(page + 1)
    }
  }

  return (
    <View className='charity-list-page'>
      {/* 返回按钮 - 与回顾详情页一致 */}
      <View className='page-back' onClick={() => Taro.navigateBack()}>
        <Text className='page-back-icon'>←</Text>
      </View>
      {/* 页面头部 - 与图2设计一致 */}
      <View className='list-header'>
        <View className='list-header-left'>
          <Text className='list-header-title'>正在进行的</Text>
          <Text className='list-header-title'>项目</Text>
          <Text className='list-header-sub'>每一步都保持透明与信任</Text>
        </View>
      </View>
      <ScrollView
        className='scroll-container'
        scrollY
        onScrollToLower={onScrollToLower}
      >
        <View className='charity-list'>
          {list.map(item => (
            <View key={item.id} className='charity-card' onClick={() => goToDetail(item.id)}>
              <Image className='charity-image' src={item.image} mode='aspectFill' />
              <View className='charity-info'>
                <Text className='charity-title'>{item.title}</Text>
                <Text className='charity-sub'>{item.location} · {item.date}</Text>
                <View className='charity-status'>
                  <Text className={`status-tag status-${item.status === '报名中' ? 'open' : item.status === '进行中' ? 'progress' : 'closed'}`}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          {loading && <Text className='loading-text'>加载中...</Text>}
          {!hasMore && list.length > 0 && <Text className='loading-text'>没有更多了</Text>}
          {!loading && list.length === 0 && <Text className='empty-text'>暂无公益活动</Text>}
        </View>
      </ScrollView>
    </View>
  )
}

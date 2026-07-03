import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { getReviews, IMAGE_BASE_URL, safeNavigateBack } from '../../../utils/api'
import './index.scss'

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr.replace(/-/g, '/'))
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`
  return dateStr.slice(0, 10)
}

export default function ReviewList() {
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
      const res = await getReviews({ page: p, page_size: 10 })
      if (res.code === 200 && res.data?.articles) {
        const items = res.data.articles.map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.event_date || '',
          location: a.location || '',
          like_count: a.like_count || 0,
          view_count: a.view_count || 0,
          image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `${IMAGE_BASE_URL}${a.cover_image}`) + '?w=750&q=75' : '',
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
      console.error('Load review list failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/reviews/detail/index?id=${id}` })
  }

  const onScrollToLower = () => {
    if (hasMore && !loading) {
      loadList(page + 1)
    }
  }

  return (
    <View className='review-list-page'>
      <View className='custom-navbar'>
        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Text className='page-back-icon'>‹</Text>
        </View>
        <Text className='navbar-title'>回忆足迹</Text>
      </View>

      <ScrollView
        className='card-scroll'
        scrollY
        onScrollToLower={onScrollToLower}
      >
        <View className='card-list'>
          {list.map(item => (
            <View key={item.id} className='story-card' onClick={() => goToDetail(item.id)}>
              <View className='card-image-wrap'>
                <Image className='card-image' src={item.image} mode='aspectFill' lazyLoad />
                {item.location && (
                  <View className='card-image-tag'>
                    <Text className='card-image-tag-text'>{item.location}</Text>
                  </View>
                )}
              </View>
              <View className='card-body'>
                <Text className='card-title'>{item.title}</Text>
                <View className='card-footer'>
                  <View className='card-stats'>
                    <View className='card-stat'>
                      <Text className='stat-icon liked'>♥</Text>
                      <Text className='stat-text'>{item.like_count}</Text>
                    </View>
                    <View className='card-stat'>
                      <Text className='stat-icon'>👁</Text>
                      <Text className='stat-text'>{item.view_count}</Text>
                    </View>
                  </View>
                  <Text className='card-time'>{formatRelativeTime(item.date)}</Text>
                </View>
              </View>
            </View>
          ))}
          {loading && <Text className='loading-text'>加载中...</Text>}
          {!hasMore && list.length > 0 && <Text className='loading-text'>没有更多了</Text>}
          {!loading && list.length === 0 && <Text className='empty-text'>暂无回顾</Text>}
        </View>
      </ScrollView>
    </View>
  )
}

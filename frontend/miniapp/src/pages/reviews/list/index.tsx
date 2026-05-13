import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { getReviews } from '../../../utils/api'
import './index.scss'

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
          participants: a.participants || 0,
          like_count: a.like_count || 0,
          view_count: a.view_count || 0,
          image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) : '',
          tag: a.location || '精彩回顾',
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
      {/* 和首页一样的导航栏 */}
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <Text className='navbar-title'>回忆足迹</Text>
        </View>
      </View>

      {/* 返回按钮 */}
      <View className='page-back' onClick={() => Taro.navigateBack()}>
        <Text className='page-back-icon'>←</Text>
      </View>

      <ScrollView
        className='card-scroll'
        scrollY
        onScrollToLower={onScrollToLower}
      >
        <View className='page-header'>
          <Text className='page-title'>回忆足迹</Text>
          <Text className='page-subtitle'>定格每一份毛孩子与你的专属旅程。</Text>
        </View>

        <View className='card-list'>
          {list.map(item => (
            <View key={item.id} className='story-card' onClick={() => goToDetail(item.id)}>
              <View className='card-image-wrap'>
                <Image className='card-image' src={item.image} mode='aspectFill' />
                <View className='card-image-tag'>
                  <Text className='card-image-tag-text'>{item.tag}</Text>
                </View>
              </View>
              <View className='card-body'>
                <Text className='card-title'>{item.title}</Text>
                <View className='card-footer'>
                  <View className='card-stats'>
                    <Text className='card-stat'>❤️ {item.like_count}</Text>
                    <Text className='card-stat'>👁 {item.view_count}</Text>
                  </View>
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

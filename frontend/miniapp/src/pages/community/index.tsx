import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { getArticles, setActiveTab } from '../../utils/api'
import './index.scss'

export default function Community() {
  const [activeTab, setActiveTabState] = useState('recommend')
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useDidShow(() => {
    setActiveTab(2, 'pages/community/index')
  })

  useEffect(() => {
    setPage(1)
    setHasMore(true)
    loadArticles(1, true)
  }, [activeTab])

  const loadArticles = async (targetPage: number = 1, reset: boolean = false) => {
    if (loading) return
    try {
      setLoading(true)
      const categoryMap: Record<string, string> = {
        recommend: 'travel',
        follow: 'guide',
        nearby: 'story',
      }
      const res = await getArticles({
        category: categoryMap[activeTab],
        page: targetPage,
        page_size: 10,
      })
      if (res.code === 200 && res.data?.articles) {
        const list = res.data.articles
        if (reset) {
          setArticles(list)
        } else {
          setArticles(prev => [...prev, ...list])
        }
        setHasMore(list.length === 10)
      } else {
        if (reset) setArticles([])
        setHasMore(false)
      }
    } catch (error) {
      console.error('Load articles failed:', error)
      if (reset) setArticles([])
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!hasMore || loading) return
    const nextPage = page + 1
    setPage(nextPage)
    loadArticles(nextPage, false)
  }

  const goToDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/community/detail/index?id=${id}` })
  }

  return (
    <View className='community-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='community-tabs'>
        <Text className={`tab ${activeTab === 'recommend' ? 'active' : ''}`} onClick={() => setActiveTabState('recommend')}>推荐</Text>
        <Text className={`tab ${activeTab === 'follow' ? 'active' : ''}`} onClick={() => setActiveTabState('follow')}>攻略</Text>
        <Text className={`tab ${activeTab === 'nearby' ? 'active' : ''}`} onClick={() => setActiveTabState('nearby')}>故事</Text>
      </View>

      <ScrollView
        className='waterfall'
        scrollY
        lowerThreshold={100}
        onScrollToLower={loadMore}
      >
        {articles.length === 0 && !loading && (
          <View className='empty-tip'>
            <Text>暂无内容，去发布第一篇吧~</Text>
          </View>
        )}
        <View className='post-list'>
          {articles.map(article => (
            <View key={article.id} className='post-card' onClick={() => goToDetail(article.id)}>
              {article.cover_image ? (
                <Image className='post-image' src={article.cover_image} mode='widthFix' />
              ) : (
                <View className='post-image-placeholder' />
              )}
              <Text className='post-title'>{article.title}</Text>
              <Text className='post-summary'>{article.summary}</Text>
              <View className='post-footer'>
                <Text className='post-author'>{article.author_name || '官方'}</Text>
                <Text className='post-likes'>❤ {article.like_count || 0}</Text>
                <Text className='post-views'>👁 {article.view_count || 0}</Text>
              </View>
            </View>
          ))}
        </View>
        {loading && <Text className='loading-text'>加载中...</Text>}
        {!hasMore && articles.length > 0 && <Text className='loading-text'>没有更多了</Text>}
      </ScrollView>
    </View>
  )
}

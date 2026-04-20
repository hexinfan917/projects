import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getRoutes, setActiveTab } from '../../utils/api'
import './index.scss'

export default function Routes() {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  useDidShow(() => {
    loadRoutes(true)
    setActiveTab(1, 'pages/routes/index')
  })

  const loadRoutes = async (refresh = false) => {
    if (loading) return
    setLoading(true)
    const currentPage = refresh ? 1 : page
    if (refresh) {
      setPage(1)
      setNoMore(false)
    }
    try {
      const res = await getRoutes({ page: currentPage, page_size: pageSize })
      const list = (res.data?.routes || []).map((r: any) => ({ ...r, price: r.base_price || 0 }))
      setRoutes(prev => refresh ? list : [...prev, ...list])
      setNoMore(list.length < pageSize)
      if (!refresh) setPage(currentPage + 1)
    } catch (err) {
      console.error('加载路线失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoutes(true)
  }, [])

  const goToDetail = (item: any) => {
    const footprints = Taro.getStorageSync('footprint_routes') || []
    const filtered = footprints.filter((f: any) => f.id !== item.id)
    const record = { id: item.id, name: item.name, cover_image: item.cover_image, type_name: item.type_name, subtitle: item.subtitle || '', price: item.price || 0, timestamp: Date.now() }
    Taro.setStorageSync('footprint_routes', [record, ...filtered].slice(0, 100))
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${item.id}` })
  }

  return (
    <View className='routes-page'>
      <ScrollView
        className='route-list'
        scrollY
        refresherEnabled
        onRefresherRefresh={() => loadRoutes(true)}
        onScrollToLower={() => !noMore && !loading && loadRoutes()}
      >
        {routes.map(item => (
          <View key={item.id} className='route-card' onClick={() => goToDetail(item)}>
            <Image className='route-image' src={item.cover_image} mode='aspectFill' />
            <View className='route-tag'>{item.type_name}</View>
            <View className='route-overlay'>
              <Text className='route-name'>{item.name}</Text>
              {item.subtitle && <Text className='route-subtitle'>{item.subtitle}</Text>}
              <Text className='route-location'>📍 杭州出发</Text>
            </View>
          </View>
        ))}
        {loading && <View className='load-more'><Text>加载中...</Text></View>}
        {noMore && <View className='no-more'><Text>没有更多了</Text></View>}
      </ScrollView>
    </View>
  )
}

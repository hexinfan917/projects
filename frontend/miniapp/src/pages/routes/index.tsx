import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
const logoIcon = '/assets/toplogo.png'
import Taro, { useDidShow } from '@tarojs/taro'
import { getRoutes, getRouteTypes, setActiveTab } from '../../utils/api'
import './index.scss'

export default function Routes() {
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const pageSize = 10

  useDidShow(() => {
    loadRoutes(true)
    loadCategories()
    setActiveTab(1, 'pages/routes/index')
  })

  useEffect(() => {
    loadRoutes(true)
  }, [activeCategory])

  const loadCategories = async () => {
    try {
      const res = await getRouteTypes()
      if (res.code === 200 && res.data) {
        setCategories([{ id: '', name: '全部线路' }, ...res.data])
      }
    } catch (err) {
      console.error('加载分类失败:', err)
    }
  }

  const loadRoutes = async (refresh = false, searchKeyword?: string) => {
    if (loading) return
    if (refresh) setRefreshing(true)
    setLoading(true)
    const currentPage = refresh ? 1 : page
    if (refresh) {
      setPage(1)
      setNoMore(false)
    }
    try {
      const params: any = { page: currentPage, page_size: pageSize }
      const kw = searchKeyword !== undefined ? searchKeyword : keyword
      if (kw) params.keyword = kw
      if (activeCategory) params.route_type = parseInt(activeCategory, 10)
      const res = await getRoutes(params)
      const list = (res.data?.routes || []).map((r: any) => ({ ...r, price: r.base_price || 0 }))
      setRoutes(prev => refresh ? list : [...prev, ...list])
      setNoMore(list.length < pageSize)
      if (!refresh) setPage(currentPage + 1)
    } catch (err) {
      console.error('加载路线失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleSearch = () => {
    loadRoutes(true)
  }

  const goToDetail = (item: any) => {
    const footprints = Taro.getStorageSync('footprint_routes') || []
    const filtered = footprints.filter((f: any) => f.id !== item.id)
    const record = { id: item.id, name: item.name, cover_image: item.cover_image, type_name: item.type_name, subtitle: item.subtitle || '', price: item.price || 0, timestamp: Date.now() }
    Taro.setStorageSync('footprint_routes', [record, ...filtered].slice(0, 100))
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${item.id}` })
  }

  return (
    <View className='routes-page'>
      {/* 自定义导航栏 */}
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='navbar-left'>
            <Image className='navbar-icon' src={logoIcon} mode='aspectFit' />
            <Text className='navbar-title'>尾巴旅行</Text>
          </View>
        </View>
      </View>

      {/* 顶部内容区 */}
      <View className='routes-header'>
        {/* 搜索栏 */}
        <View className='routes-search'>
          <View className='routes-search-input'>
            <Text className='routes-search-icon'>🔍</Text>
            <Input
              className='routes-search-text'
              placeholder='搜索路线、地点'
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
              onConfirm={handleSearch}
            />
            {keyword ? (
              <Text className='routes-search-clear' onClick={() => { setKeyword(''); loadRoutes(true, ''); }}>✕</Text>
            ) : null}
          </View>
        </View>

        {/* 标题 */}
        <View className='routes-hero'>
          <Text className='routes-hero-title'>线路</Text>
          <Text className='routes-hero-subtitle'>发现适合您和爱宠的独家旅行路径。</Text>
        </View>

        {/* 分类筛选 */}
        <ScrollView className='routes-categories' scrollX>
          {categories.map(cat => (
            <View
              key={cat.id}
              className={`routes-category ${activeCategory === String(cat.id) ? 'active' : ''}`}
              onClick={() => setActiveCategory(String(cat.id))}
            >
              <Text className='routes-category-text'>{cat.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className='route-list'
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
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
            </View>
          </View>
        ))}
        {loading && <View className='load-more'><Text>加载中...</Text></View>}
        {noMore && <View className='no-more'><Text>没有更多了</Text></View>}
      </ScrollView>
    </View>
  )
}

import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro, { useDidShow, getCurrentInstance } from '@tarojs/taro'
import { getRoutes, getRouteTypes, getMemberCenter, setActiveTab, IMAGE_BASE_URL } from '../../utils/api'
import { setTabBarSelected } from '../../utils/tabbar'
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
  const [isMember, setIsMember] = useState(false)
  const [navHeight, setNavHeight] = useState(88)
  const [listHeight, setListHeight] = useState(600)
  const [statusBarHeight, setStatusBarHeight] = useState(40)
  const [categoryScrollLeft, setCategoryScrollLeft] = useState(0)
  const pageSize = 10

  useDidShow(() => {
    setTabBarSelected(1)
    loadRoutes(true)
    loadCategories()
    setActiveTab(1, 'pages/routes/index')
    getMemberCenter().then(res => setIsMember(!!res.data?.is_member)).catch(() => setIsMember(false))
  })

  useEffect(() => {
    const sys = Taro.getSystemInfoSync()
    const sbh = sys.statusBarHeight || 20
    const navH = sbh + 44
    setStatusBarHeight(sbh)
    setNavHeight(navH)
    // windowHeight 是不含 tabBar 的可使用窗口高度，直接减去自定义导航栏高度
    setListHeight(Math.max(sys.windowHeight - navH, 300))
  }, [])

  useEffect(() => {
    loadRoutes(true)
  }, [activeCategory])

  const loadCategories = async () => {
    try {
      const res = await getRouteTypes()
      if (res.code === 200 && res.data) {
        setCategories([{ id: '', name: '全部活动' }, ...res.data])
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
      const list = (res.data?.routes || []).map((r: any) => {
        const hasSchedule = r.schedule_price !== undefined && r.schedule_price !== null
        const displayPrice = isMember && r.schedule_member_price != null
          ? r.schedule_member_price
          : (hasSchedule ? r.schedule_price : 0)
        return {
          ...r,
          price: displayPrice,
          has_schedule: hasSchedule,
          cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `${IMAGE_BASE_URL}${r.cover_image}`) + '?w=750&q=75' : ''
        }
      })
      setRoutes(prev => refresh ? list : [...prev, ...list])
      setNoMore(list.length < pageSize)
      if (!refresh) setPage(currentPage + 1)
    } catch (err) {
      console.error('加载活动失败:', err)
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
    const record = { id: item.id, name: item.name, cover_image: item.cover_image, type_name: item.type_name, subtitle: item.subtitle || '', price: item.price, has_schedule: item.has_schedule, timestamp: Date.now() }
    Taro.setStorageSync('footprint_routes', [record, ...filtered].slice(0, 100))
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${item.id}` })
  }

  return (
    <View className='routes-page' style={{ paddingTop: `${navHeight}px` }}>
      {/* 自定义导航栏品牌（填充顶部空白） */}
      <View className='routes-fixed-navbar' style={{ height: `${navHeight}px`, paddingTop: `${statusBarHeight}px` }}>
        <View className='routes-fixed-brand'>
          <Image className='routes-fixed-logo' src='/assets/toplogo.png' mode='aspectFit' />
          <Text className='routes-fixed-brand-text'>PetWay</Text>
        </View>
      </View>

      {/* 活动列表（包含搜索栏、分类筛选，随页面一起滚动） */}
      <ScrollView
        className='route-list'
        style={{ height: `${listHeight}px` }}
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => loadRoutes(true)}
        onScrollToLower={() => !noMore && !loading && loadRoutes()}
      >
        {/* 搜索栏 */}
        <View className='routes-search'>
          <View className='routes-search-input'>
            <Text className='routes-search-icon'>🔍</Text>
            <Input
              className='routes-search-text'
              placeholder='搜索活动、地点...'
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
              onConfirm={handleSearch}
            />
            {keyword ? (
              <Text className='routes-search-clear' onClick={() => { setKeyword(''); loadRoutes(true, ''); }}>✕</Text>
            ) : null}
          </View>
        </View>

        {/* 分类筛选 */}
        <ScrollView
          id='routesCategories'
          className='routes-categories'
          scrollX
          scrollWithAnimation
          showScrollbar={false}
          scrollLeft={categoryScrollLeft}
        >
          <View className='routes-categories-track'>
            {categories.map(cat => (
              <View
                key={cat.id}
                id={`cat_${cat.id || 'all'}`}
                className={`routes-category ${activeCategory === String(cat.id) ? 'active' : ''}`}
                onClick={() => {
                  const id = String(cat.id)
                  setActiveCategory(id)
                  setTimeout(() => {
                    const instance = getCurrentInstance()
                    const scope = instance.page || instance
                    Taro.createSelectorQuery()
                      .in(scope)
                      .select('#routesCategories')
                      .boundingClientRect()
                      .select(`#cat_${id || 'all'}`)
                      .boundingClientRect()
                      .exec(([container, target]: any[]) => {
                        if (container && target) {
                          const targetLeft = target.left - container.left
                          const targetRight = targetLeft + target.width
                          const containerWidth = container.width
                          let nextScrollLeft = categoryScrollLeft
                          if (targetRight > containerWidth) {
                            nextScrollLeft += targetRight - containerWidth + 16
                          } else if (targetLeft < 0) {
                            nextScrollLeft = Math.max(0, nextScrollLeft + targetLeft - 16)
                          }
                          setCategoryScrollLeft(nextScrollLeft)
                        }
                      })
                  }, 50)
                }}
              >
                <Text className='routes-category-text'>{cat.id === '' ? '全部' : cat.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* 活动卡片 */}
        {routes.map(item => (
          <View key={item.id} className='route-card' onClick={() => goToDetail(item)}>
            <View className='route-image-wrap'>
              <Image className='route-image' src={item.cover_image} mode='aspectFill' />
              {item.type_name ? <View className='route-tag'>{item.type_name}</View> : null}
            </View>
            <View className='route-info'>
              <Text className='route-name'>{item.name}</Text>
              {item.subtitle ? (
                <View className='route-location'>
                  <View className='location-icon' />
                  <Text className='location-text'>{item.subtitle}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
        {loading && <View className='load-more'><Text>加载中...</Text></View>}
        {noMore && <View className='no-more'><Text>没有更多了</Text></View>}
      </ScrollView>

    </View>
  )
}

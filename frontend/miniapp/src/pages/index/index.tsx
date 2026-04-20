import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { setActiveTab } from '../../utils/api'
import { View, Text, Swiper, SwiperItem, Image, ScrollView } from '@tarojs/components'
import './index.scss'

// 首页（发现页）
export default function Index() {
  const [banners, setBanners] = useState([])
  const [routes, setRoutes] = useState([])
  const [reviews, setReviews] = useState([])
  const [charities, setCharities] = useState([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    loadHomeData()
    setActiveTab(0, 'pages/index/index')
  })

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    try {
      setLoading(true)
      setBanners([
        { id: 1, image: 'https://via.placeholder.com/750x320/22C55E/FFFFFF?text=Banner1' },
        { id: 2, image: 'https://via.placeholder.com/750x320/4ECDC4/FFFFFF?text=Banner2' },
        { id: 3, image: 'https://via.placeholder.com/750x320/45B7D1/FFFFFF?text=Banner3' },
      ])
      
      setRoutes([
        { id: 1, name: '海滨漫步一日游', type: '海滨线', price: 199, cover_image: 'https://via.placeholder.com/620x420/4ECDC4/FFFFFF?text=Beach' },
        { id: 2, name: '山居野趣两日游', type: '山居线', price: 399, cover_image: 'https://via.placeholder.com/620x420/96C93D/FFFFFF?text=Mountain' },
        { id: 3, name: '森林露营体验', type: '露营线', price: 299, cover_image: 'https://via.placeholder.com/620x420/22C55E/FFFFFF?text=Forest' },
      ])

      setReviews([
        { id: 1, title: '金毛海滩派对精彩回顾', date: '2024.06.15', location: '厦门环岛路', participants: 86, image: 'https://via.placeholder.com/700x380/FF8C42/FFFFFF?text=Review1' },
        { id: 2, title: '森林探秘·柴犬专场', date: '2024.05.20', location: '莫干山', participants: 52, image: 'https://via.placeholder.com/700x380/4ECDC4/FFFFFF?text=Review2' },
        { id: 3, title: '城市夜跑·边牧集结', date: '2024.04.08', location: '西湖沿线', participants: 120, image: 'https://via.placeholder.com/700x380/45B7D1/FFFFFF?text=Review3' },
      ])

      setCharities([
        { id: 1, title: '流浪狗救助站义工招募', date: '2024.07.10', location: '杭州余杭', status: '报名中', image: 'https://via.placeholder.com/700x380/96C93D/FFFFFF?text=Charity1' },
        { id: 2, title: '流浪狗爱心领养日', date: '2024.07.20', location: '城西银泰', status: '预热中', image: 'https://via.placeholder.com/700x380/F9A825/FFFFFF?text=Charity2' },
        { id: 3, title: '老年犬关爱公益行', date: '2024.08.05', location: '全城联动', status: '报名中', image: 'https://via.placeholder.com/700x380/667EEA/FFFFFF?text=Charity3' },
      ])
    } catch (error) {
      console.error('Load home data failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = () => {
    loadHomeData()
  }

  const goToRouteDetail = (route: any) => {
    const footprints = Taro.getStorageSync('footprint_routes') || []
    const filtered = footprints.filter((f: any) => f.id !== route.id)
    const record = { id: route.id, name: route.name, cover_image: route.cover_image, type_name: route.type || '', subtitle: route.subtitle || '', price: route.price || 0, timestamp: Date.now() }
    Taro.setStorageSync('footprint_routes', [record, ...filtered].slice(0, 100))
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${route.id}` })
  }

  const goToReviewDetail = (id) => {
    Taro.navigateTo({ url: `/pages/reviews/detail/index?id=${id}` })
  }

  const goToCharityDetail = (id) => {
    Taro.navigateTo({ url: `/pages/charities/detail/index?id=${id}` })
  }

  return (
    <View className='index-page'>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-input'>
          <Text className='search-icon'>🔍</Text>
          <Text className='search-placeholder'>搜索路线、地点</Text>
        </View>
      </View>

      <ScrollView
        className='scroll-container'
        scrollY
        refresherEnabled
        refresherTriggered={loading}
        onRefresherRefresh={onRefresh}
      >
        {/* 轮播图 */}
        <Swiper className='banner-swiper' indicatorDots autoplay interval={5000}>
          {banners.map(banner => (
            <SwiperItem key={banner.id}>
              <Image className='banner-image' src={banner.image} mode='aspectFill' />
            </SwiperItem>
          ))}
        </Swiper>

        {/* 品牌标语 */}
        <View className='brand-slogan'>
          <Text className='slogan-text'>尾巴旅行，与爱宠并肩同行</Text>
        </View>

        {/* 热门路线 */}
        <View className='section-block'>
          <View className='section-header-row'>
            <View>
              <Text className='section-title-main'>热门路线</Text>
              <Text className='section-title-sub'>精选最受欢迎的宠物旅行目的地</Text>
            </View>
            <Text className='section-more'>更多 ></Text>
          </View>
          
          <ScrollView className='trip-scroll' scrollX>
            {routes.map(route => (
              <View key={route.id} className='trip-card' onClick={() => goToRouteDetail(route)}>
                <Image className='trip-image' src={route.cover_image} mode='aspectFill' />
                <View className='trip-tag'>{route.type}</View>
                <View className='trip-overlay'>
                  <Text className='trip-name'>{route.name}</Text>
                  <Text className='trip-location'>📍 杭州出发</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 狗狗回顾 */}
        <View className='section-block'>
          <View className='section-header-row'>
            <View>
              <Text className='section-title-main'>狗狗回顾</Text>
              <Text className='section-title-sub'>记录与毛孩子的每一次美好旅程</Text>
            </View>
            <Text className='section-more'>更多 ></Text>
          </View>
          
          <View className='story-list'>
            {reviews.map(review => (
              <View key={review.id} className='story-card' onClick={() => goToReviewDetail(review.id)}>
                <Image className='story-image' src={review.image} mode='aspectFill' />
                <View className='story-overlay'>
                  <Text className='story-title'>{review.title}</Text>
                  <Text className='story-sub'>{review.location} · {review.participants}只狗狗参与</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 狗狗公益 */}
        <View className='section-block'>
          <View className='section-header-row'>
            <View>
              <Text className='section-title-main'>狗狗公益</Text>
              <Text className='section-title-sub'>用爱传递温暖，守护每一个小生命</Text>
            </View>
            <Text className='section-more'>更多 ></Text>
          </View>
          
          <View className='story-list'>
            {charities.map(charity => (
              <View key={charity.id} className='story-card' onClick={() => goToCharityDetail(charity.id)}>
                <Image className='story-image' src={charity.image} mode='aspectFill' />
                <View className='story-overlay'>
                  <Text className='story-title'>{charity.title}</Text>
                  <Text className='story-sub'>{charity.location} · {charity.status}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

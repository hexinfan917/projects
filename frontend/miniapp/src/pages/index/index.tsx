import { useEffect, useState } from 'react'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { setActiveTab, getRoutes, getCharityActivities, getReviews, getBanners, getMemberPopup, logPopupAction, getMemberCenter, IMAGE_BASE_URL } from '../../utils/api'
import { View, Text, Swiper, SwiperItem, Image, ScrollView, Input } from '@tarojs/components'
const logoIcon = '/assets/toplogo.png'

import './index.scss'

definePageConfig({
  enableShareAppMessage: true,
  enableShareTimeline: true,
})

// 快捷入口模块
const QUICK_MODULES = [
  { key: 'featured', label: '主题精选', icon: '/assets/icons/featured.svg', path: '/pages/routes/index' },
  { key: 'personality', label: '犬格检测', icon: '/assets/icons/personality.svg', path: '/pages/routes/index' },
  { key: 'adoption', label: '狗狗领养', icon: '/assets/icons/adoption.svg', path: '/pages/charities/list/index' },
  { key: 'wiki', label: '养宠百科', icon: '/assets/icons/wiki.svg', path: '/pages/reviews/list/index' },
]

// 首页（发现页）- V2 沉浸式设计
export default function Index() {
  const [banners, setBanners] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [charities, setCharities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [popupVisible, setPopupVisible] = useState(false)
  const [popupData, setPopupData] = useState<any>(null)
  const [isMember, setIsMember] = useState(false)

  // 分享给好友
  useShareAppMessage(() => {
    return {
      title: '尾巴PetWay - 带宠出行首选',
      path: '/pages/index/index',
      imageUrl: routes[0]?.cover_image || logoIcon,
    }
  })

  // 分享到朋友圈
  useShareTimeline(() => {
    return {
      title: '尾巴PetWay - 带宠出行首选',
      query: '',
      imageUrl: routes[0]?.cover_image || logoIcon,
    }
  })

  useDidShow(() => {
    loadHomeData()
    setActiveTab(0, 'pages/index/index')
    loadPopup()
    getMemberCenter().then(res => setIsMember(!!res.data?.is_member)).catch(() => setIsMember(false))
    setTimeout(() => {
      setSearchKeyword('')
    }, 50)
  })

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadPopup = async () => {
    const dismissed = Taro.getStorageSync('home_popup_dismissed')
    if (dismissed) return
    try {
      const res = await getMemberPopup()
      if (res.code === 200 && res.data?.should_show) {
        const popup = res.data.popup
        setPopupData(popup)
        setPopupVisible(true)
        if (popup?.id) {
          logPopupAction(popup.id, 1)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handlePopupClose = () => {
    setPopupVisible(false)
    Taro.setStorageSync('home_popup_dismissed', true)
    if (popupData?.id) {
      logPopupAction(popupData.id, 3)
    }
  }

  const handlePopupOpen = () => {
    setPopupVisible(false)
    Taro.setStorageSync('home_popup_dismissed', true)
    if (popupData?.id) {
      logPopupAction(popupData.id, 2)
    }
    const token = Taro.getStorageSync('access_token')
    const targetUrl = popupData?.target_page || '/pages/member/center/index'
    if (!token) {
      Taro.navigateTo({ url: `/pages/login/index?redirect=${targetUrl}` })
      return
    }
    Taro.navigateTo({ url: targetUrl })
  }

  const loadHomeData = async () => {
    try {
      setLoading(true)
      const bannerRes = await getBanners()
      if (bannerRes.code === 200 && bannerRes.data?.banners) {
        setBanners(bannerRes.data.banners.map((b: any) => ({
          id: b.id,
          image: b.image_url ? (b.image_url.startsWith('http') ? b.image_url : `${IMAGE_BASE_URL}${b.image_url}`) + '?w=750&q=75' : '',
          link_url: b.link_url || '',
          title: b.title || '',
          subtitle: b.subtitle || '',
          tag: b.tag || '精选路线',
        })))
      } else {
        setBanners([])
      }

      const routeRes = await getRoutes({ page_size: 4, sort_by: 'recommend', is_hot: 1 })
      if (routeRes.code === 200 && routeRes.data?.routes) {
        setRoutes(routeRes.data.routes.map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.route_type_name || r.type_name || '精选',
          price: isMember && r.schedule_member_price != null
            ? r.schedule_member_price
            : ((r.schedule_price !== undefined && r.schedule_price !== null) ? r.schedule_price : (r.price || 0)),
          cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `${IMAGE_BASE_URL}${r.cover_image}`) + '?w=750&q=75' : 'https://via.placeholder.com/620x420/CCCCCC/FFFFFF?text=No+Image',
          subtitle: r.subtitle || '',
          location: r.location || '',
        })))
      }

      const reviewRes = await getReviews({ page_size: 4 })
      if (reviewRes.code === 200 && reviewRes.data?.articles) {
        setReviews(reviewRes.data.articles.map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.event_date || '',
          location: a.location || '',
          participants: a.participants || 0,
          image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `${IMAGE_BASE_URL}${a.cover_image}`) + '?w=750&q=75' : 'https://via.placeholder.com/700x380/CCCCCC/FFFFFF?text=No+Image',
        })))
      }

      const charityRes = await getCharityActivities({ page_size: 3, status: 1 })
      if (charityRes.code === 200 && charityRes.data?.activities) {
        setCharities(charityRes.data.activities.map((a: any) => ({
          id: a.id,
          title: a.title,
          subtitle: a.subtitle || '',
          date: a.start_date || '',
          location: a.location || '',
          status: a.status_name || '报名中',
          image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `${IMAGE_BASE_URL}${a.cover_image}`) + '?w=750&q=75' : 'https://via.placeholder.com/700x380/96C93D/FFFFFF?text=Charity',
        })))
      }
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
    const record = { id: route.id, name: route.name, cover_image: route.cover_image, type_name: route.type || '', subtitle: route.subtitle || '', price: route.price, has_schedule: route.price !== undefined && route.price !== null, timestamp: Date.now() }
    Taro.setStorageSync('footprint_routes', [record, ...filtered].slice(0, 100))
    Taro.navigateTo({ url: `/pages/routes/detail/index?id=${route.id}` })
  }

  const goToReviewDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/reviews/detail/index?id=${id}` })
  }

  const goToCharityDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/charities/detail/index?id=${id}` })
  }

  const handleHomeSearch = () => {
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim()
      Taro.navigateTo({
        url: `/pages/search/index?keyword=${encodeURIComponent(kw)}`,
        complete: () => {
          setSearchKeyword('')
        }
      })
    }
  }

  const clearHomeSearch = () => {
    setSearchKeyword('')
  }

  const handleQuickModule = (module: typeof QUICK_MODULES[0]) => {
    if (module.path.startsWith('/pages/')) {
      if (module.path === '/pages/routes/index') {
        Taro.switchTab({ url: module.path })
      } else {
        Taro.navigateTo({ url: module.path })
      }
    }
  }

  // 轮播图占位兜底
  const displayBanners = banners.length > 0 ? banners : [
    { id: 0, image: '', link_url: '', title: '湖畔森呼吸 · 房车之旅', subtitle: '带上毛孩子，开启一场逃离都市的治愈之旅', tag: '精品路线' },
  ]

  return (
    <View className='index-page'>
      {/* 顶部导航栏 */}
      <View className='top-app-bar'>
        <View className='top-app-bar-bg' />
        <View className='top-app-bar-content'>
          <View className='top-app-bar-left'>
            <Image className='top-app-bar-icon' src={logoIcon} mode='aspectFit' />
            <Text className='top-app-bar-title'>PetWay</Text>
          </View>
          <View className='top-app-bar-right'>
            <Text className='top-app-bar-dot'>●</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className='scroll-container'
        scrollY
        refresherEnabled
        refresherTriggered={loading}
        onRefresherRefresh={onRefresh}
      >
        {/* 1. 沉浸式竖版轮播图 */}
        <View className='hero-section'>
          <Swiper
            className='hero-swiper'
            vertical
            autoplay
            interval={5000}
            duration={800}
            circular
          >
            {displayBanners.map((banner, idx) => (
              <SwiperItem key={String(banner.id || idx)}>
                <View className='hero-slide' onClick={() => banner.link_url && Taro.navigateTo({ url: banner.link_url })}>
                  {banner.image ? (
                    <Image className='hero-image' src={banner.image} mode='aspectFill' lazyLoad />
                  ) : (
                    <View className='hero-image hero-image-placeholder' />
                  )}
                  <View className='hero-gradient' />
                  <View className='hero-content'>
                    <Text className='hero-tag'>{banner.tag || '精品路线'}</Text>
                    <Text className='hero-title'>{banner.title || '尾巴PetWay'}</Text>
                    <Text className='hero-subtitle'>{banner.subtitle || '陪伴的意义，是认识新朋友——对它们也是'}</Text>
                  </View>
                </View>
              </SwiperItem>
            ))}
          </Swiper>
        </View>

        {/* 2. 四大功能模块 */}
        <View className='quick-modules-wrap'>
          <View className='quick-modules-shadow' />
          <View className='quick-modules-card'>
            {QUICK_MODULES.map(module => (
              <View key={module.key} className='quick-module-item' onClick={() => handleQuickModule(module)}>
                <View className='quick-module-icon'>
                  <Image className='quick-module-icon-img' src={module.icon} mode='aspectFit' />
                </View>
                <Text className='quick-module-label'>{module.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 3. 热门活动 - 错位双列 */}
        <View className='section-block activity-section'>
          <View className='section-header-row'>
            <View>
              <Text className='section-title-main'>热门活动</Text>
              <View className='section-title-underline' />
            </View>
            <Text className='section-more' onClick={() => Taro.switchTab({ url: '/pages/routes/index' })}>
              Explore more <Text className='section-more-arrow'>→</Text>
            </Text>
          </View>

          <View className='activity-grid'>
            {routes.map((route, index) => (
              <View
                key={route.id}
                className={`activity-card ${index % 2 === 1 ? 'activity-card-offset' : ''}`}
                onClick={() => goToRouteDetail(route)}
              >
                <Image className='activity-image' src={route.cover_image} mode='aspectFill' lazyLoad />
                <View className='activity-gradient' />
                <View className='activity-info'>
                  <Text className='activity-location'>{route.location || route.type}</Text>
                  <Text className='activity-name'>{route.name}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 4. 狗狗领养（公益）- 情感轮播 */}
        <View className='section-block adoption-section'>
          <View className='section-header-simple'>
            <Text className='section-title-main'>狗狗领养</Text>
            <Text className='section-title-sub'>给流浪的小生命一个温暖的家</Text>
          </View>

          <View className='adoption-carousel'>
            <Swiper
              className='adoption-swiper'
              vertical
              autoplay
              interval={6000}
              duration={800}
              circular
            >
              {charities.map((charity, idx) => (
                <SwiperItem key={String(charity.id)}>
                  <View className='adoption-slide' onClick={() => goToCharityDetail(charity.id)}>
                    <Image className='adoption-image' src={charity.image} mode='aspectFill' lazyLoad />
                    <View className='adoption-gradient' />
                    <View className='adoption-content'>
                      <Text className='adotion-quote'>“{idx === 0 ? '我在等一个你' : '带我回家吧'}”</Text>
                      <Text className='adoption-desc'>{charity.title} · {charity.subtitle || '给它一个家'}</Text>
                      <View className='adoption-btn'>
                        <Text className='adoption-btn-text'>{idx === 0 ? '了解 TA 的故事' : '申请领养'}</Text>
                      </View>
                    </View>
                  </View>
                </SwiperItem>
              ))}
              {charities.length === 0 && (
                <SwiperItem>
                  <View className='adoption-slide adoption-slide-empty'>
                    <Text className='adoption-empty-text'>暂无待领养信息</Text>
                  </View>
                </SwiperItem>
              )}
            </Swiper>
          </View>
        </View>

        {/* 5. 过往精彩回顾 - 横向滚动 */}
        <View className='section-block memories-section'>
          <View className='memories-header'>
            <Text className='memories-title'>过往精彩回顾</Text>
            <Text className='memories-label'>Memories</Text>
          </View>
          <ScrollView className='memories-scroll' scrollX showScrollbar={false}>
            {reviews.map(review => (
              <View key={review.id} className='memory-card' onClick={() => goToReviewDetail(review.id)}>
                <Image className='memory-image' src={review.image} mode='aspectFill' lazyLoad />
                <View className='memory-overlay'>
                  <Text className='memory-title'>{review.location} · {review.date ? review.date.split('-')[0] : '2024'}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 底部安全区占位 */}
        <View className='safe-bottom-placeholder' />
      </ScrollView>

      {/* 会员活动弹窗 */}
      {popupVisible && popupData && (
        <View className='member-popup-wrap'>
          <View className='member-popup-mask' onClick={handlePopupClose} />
          <View className='member-popup-content'>
            <Text className='member-popup-close' onClick={handlePopupClose}>✕</Text>
            <Image className='member-popup-poster' src={popupData.image ? (popupData.image.startsWith('http') ? popupData.image : `${IMAGE_BASE_URL}${popupData.image}`) + '?w=600&q=75' : '/assets/images/member.jpg'} mode='widthFix' />
            {popupData.title && <Text className='member-popup-title'>{popupData.title}</Text>}
            {popupData.subtitle && <Text className='member-popup-subtitle'>{popupData.subtitle}</Text>}
            {popupData.content?.benefits?.length > 0 && (
              <View className='member-popup-benefits'>
                {popupData.content.benefits.map((b: string, i: number) => (
                  <Text key={i} className='member-popup-benefit'>• {b}</Text>
                ))}
              </View>
            )}
            {popupData.content?.price_display && (
              <View className='member-popup-price-row'>
                <Text className='member-popup-price'>{popupData.content.price_display}</Text>
                {popupData.content.original_price && <Text className='member-popup-original'>{popupData.content.original_price}</Text>}
              </View>
            )}
            <View className='member-popup-footer'>
              <View
                className='member-popup-btn'
                style={{ backgroundColor: popupData.primary_btn_color || '#22C55E' }}
                onClick={handlePopupOpen}
              >
                <Text className='member-popup-btn-text'>{popupData.primary_btn_text || '立即开通'}</Text>
              </View>
              {popupData.close_btn_text && (
                <Text className='member-popup-close-text' onClick={handlePopupClose}>{popupData.close_btn_text}</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

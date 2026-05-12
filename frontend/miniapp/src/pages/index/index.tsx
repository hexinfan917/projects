import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { setActiveTab, getRoutes, getCharityActivities, getReviews, getBanners, getMemberPopup, logPopupAction, BASE_URL } from '../../utils/api'
import { View, Text, Swiper, SwiperItem, Image, ScrollView, Input } from '@tarojs/components'
const logoIcon = '/assets/toplogo.png'

import './index.scss'

// 首页（发现页）
export default function Index() {
  const [banners, setBanners] = useState([])
  const [routes, setRoutes] = useState([])
  const [reviews, setReviews] = useState([])
  const [charities, setCharities] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [popupVisible, setPopupVisible] = useState(false)
  const [popupData, setPopupData] = useState<any>(null)

  useDidShow(() => {
    loadHomeData()
    setActiveTab(0, 'pages/index/index')
    loadPopup()
    // 延迟清空搜索框，确保页面完全显示后生效
    setTimeout(() => {
      setSearchKeyword('')
    }, 50)
  })

  const loadPopup = async () => {
    // 当前小程序生命周期内已关闭过则不再弹
    if (Taro.getStorageSync('home_popup_dismissed')) return
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
    if (popupData?.id) {
      logPopupAction(popupData.id, 2)
    }
    const token = Taro.getStorageSync('access_token')
    const targetUrl = popupData?.target_page || '/pages/member/center/index'
    if (!token) {
      Taro.navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent(targetUrl)}` })
      return
    }
    Taro.navigateTo({ url: targetUrl })
  }

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    try {
      setLoading(true)
      // 从后端获取轮播图
      const bannerRes = await getBanners()
      if (bannerRes.code === 200 && bannerRes.data?.banners) {
        setBanners(bannerRes.data.banners.map((b: any) => ({
          id: b.id,
          image: b.image_url ? (b.image_url.startsWith('http') ? b.image_url : `http://localhost:8081${b.image_url}`) : '',
          link_url: b.link_url || '',
        })))
      } else {
        setBanners([])
      }
      
      // 从后端获取热门路线
      const routeRes = await getRoutes({ page_size: 6, sort_by: 'recommend', is_hot: 1 })
      if (routeRes.code === 200 && routeRes.data?.routes) {
        setRoutes(routeRes.data.routes.map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.route_type_name || r.type_name || '精选',
          price: r.base_price || r.price || 0,
          cover_image: r.cover_image || 'https://via.placeholder.com/620x420/CCCCCC/FFFFFF?text=No+Image',
          subtitle: r.subtitle || ''
        })))
      }

      // 从后端获取狗狗回顾
      const reviewRes = await getReviews({ page_size: 3 })
      if (reviewRes.code === 200 && reviewRes.data?.articles) {
        setReviews(reviewRes.data.articles.map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.event_date || '',
          location: a.location || '',
          participants: a.participants || 0,
          image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `http://localhost:8081${a.cover_image}`) : 'https://via.placeholder.com/700x380/CCCCCC/FFFFFF?text=No+Image',
        })))
      }

      // 从后端获取公益活动
      const charityRes = await getCharityActivities({ page_size: 3, status: 1 })
      if (charityRes.code === 200 && charityRes.data?.activities) {
        setCharities(charityRes.data.activities.map((a: any) => ({
          id: a.id,
          title: a.title,
          date: a.start_date || '',
          location: a.location || '',
          status: a.status_name || '报名中',
          image: a.cover_image || 'https://via.placeholder.com/700x380/96C93D/FFFFFF?text=Charity',
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
    const record = { id: route.id, name: route.name, cover_image: route.cover_image, type_name: route.type || '', subtitle: route.subtitle || '', price: route.price || 0, timestamp: Date.now() }
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

  return (
    <View className='index-page'>
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
      <ScrollView
        className='scroll-container'
        scrollY
        refresherEnabled
        refresherTriggered={loading}
        onRefresherRefresh={onRefresh}
      >
        {/* 占位区域，避免内容被 fixed 导航栏遮挡 */}
        <View className='navbar-placeholder' />
        {/* 搜索栏 */}
        <View className='search-bar'>
          <View className='search-input'>
            <Text className='search-icon'>🔍</Text>
            <Input
              className='search-text'
              placeholder='搜索热门路线'
              value={searchKeyword}
              onInput={(e) => setSearchKeyword(e.detail.value)}
              onConfirm={handleHomeSearch}
            />
            {searchKeyword ? (
              <Text className='search-clear' onClick={clearHomeSearch}>✕</Text>
            ) : null}
          </View>
        </View>
        {/* 轮播图 */}
        <Swiper className='banner-swiper' indicatorDots autoplay interval={5000}>
          {banners.map(banner => (
            <SwiperItem key={String(banner.id)}>
              <View className='banner-item' onClick={() => {
                if (banner.link_url) {
                  Taro.navigateTo({ url: banner.link_url })
                }
              }}>
                <Image
                  className='banner-image'
                  src={banner.image}
                  mode='aspectFill'
                  lazyLoad
                  onError={(e) => console.error('Banner image load error:', e)}
                />
              </View>
            </SwiperItem>
          ))}
        </Swiper>

        {/* 品牌标语 */}
        <View className='brand-slogan'>
          <Text className='slogan-text'>旅行的意义，是认识新朋友——对它们也是</Text>
        </View>

        {/* 热门路线 */}
        <View className='section-block'>
          <View className='section-header-row'>
            <View>
              <Text className='section-title-main'>热门路线</Text>
              <Text className='section-title-sub'>精选最受欢迎的宠物旅行目的地</Text>
            </View>
            <Text className='section-more' onClick={() => Taro.switchTab({ url: '/pages/routes/index' })}>更多 {'>'}</Text>
          </View>
          
          <ScrollView className='trip-scroll' scrollX>
            {routes.map(route => (
              <View key={route.id} className='trip-card' onClick={() => goToRouteDetail(route)}>
                <Image className='trip-image' src={route.cover_image} mode='aspectFill' />
                <View className='trip-tag'>{route.type}</View>
                <View className='trip-overlay'>
                  <Text className='trip-name'>{route.name}</Text>
                  {route.subtitle ? <Text className='trip-subtitle'>{route.subtitle}</Text> : null}
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
            <Text className='section-more' onClick={() => Taro.navigateTo({ url: '/pages/reviews/list/index' })}>更多 {'>'}</Text>
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
            <Text className='section-more' onClick={() => Taro.navigateTo({ url: '/pages/charities/list/index' })}>更多 {'>'}</Text>
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

      {/* 会员活动弹窗 */}
      {popupVisible && popupData && (
        <View className='member-popup-wrap'>
          <View className='member-popup-mask' onClick={handlePopupClose} />
          <View className='member-popup-content'>
            <Text className='member-popup-close' onClick={handlePopupClose}>✕</Text>
            <Image className='member-popup-poster' src={popupData.image ? (popupData.image.startsWith('http') ? popupData.image : `${BASE_URL}${popupData.image}`) : '/assets/images/member.jpg'} mode='widthFix' />
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
                style={{ backgroundColor: popupData.primary_btn_color || '#FF6B35' }}
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

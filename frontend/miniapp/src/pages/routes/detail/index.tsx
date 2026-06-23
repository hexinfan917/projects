import { useEffect, useState, useMemo } from 'react'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { View, Text, Image, ScrollView, RichText, Swiper, SwiperItem, Button } from '@tarojs/components'
import { getRouteDetail, getRouteSchedules, getMemberCenter, IMAGE_BASE_URL, safeNavigateBack } from '../../../utils/api'
import BookingPopup from '../../../components/BookingPopup'
import './index.scss'

const FILE_BASE_URL = IMAGE_BASE_URL
const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 处理富文本中的图片：补全相对路径 + 自适应样式 */
function processRichText(html: string): string {
  if (!html) return ''
  let processed = html

  // 给 p/div/section/article/li 等文本块加左右 margin，让文字段落不贴边
  // 注意：rich-text 内部 HTML style 不支持 rpx，需用 px
  processed = processed.replace(/<(p|div|section|article|li)([^>]*?)>/gi, (match: string, tag: string, attrs: string) => {
    if (attrs.includes('style=')) {
      return match.replace(/style\s*=\s*"([^"]*)"/i, (m, styleValue) => {
        return `style="${styleValue};margin-left:16px;margin-right:16px;"`
      })
    }
    return `<${tag}${attrs} style="margin-left:16px;margin-right:16px;">`
  })

  return processed.replace(/<img([^>]*?)>/gi, (match: string, attrs: string) => {
    let newAttrs = attrs

    // 1. 补全图片相对路径
    const srcMatch = newAttrs.match(/src\s*=\s*["']?([^"'>\s]+)["']?/i)
    if (srcMatch) {
      const src = srcMatch[1]
      if (src && !src.startsWith('http')) {
        const fullSrc = `${FILE_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`
        const compressSrc = fullSrc + '?w=800&q=75'
        newAttrs = newAttrs.replace(srcMatch[0], `src="${compressSrc}"`)
      }
    }

    // 2. 移除 width/height 属性
    newAttrs = newAttrs
      .replace(/\s+width\s*=\s*["']?[^"'>\s]*["']?/gi, '')
      .replace(/\s+height\s*=\s*["']?[^"'>\s]*["']?/gi, '')

    // 3. 处理 style 属性：移除 width/height，图片横向占满屏幕
    const styleMatch = newAttrs.match(/style\s*=\s*"([^"]*)"/i)
    if (styleMatch) {
      let styleValue = styleMatch[1]
        .replace(/\bwidth\s*:\s*[^;]+;?/gi, '')
        .replace(/\bheight\s*:\s*[^;]+;?/gi, '')
        .replace(/\bmax-width\s*:\s*[^;]+;?/gi, '')
        .replace(/;+/g, ';')
        .replace(/^;|;$/g, '')
      newAttrs = newAttrs.replace(/style\s*=\s*"[^"]*"/i, `style="${styleValue};width:calc(100% + 32px);height:auto;display:block;margin-left:-16px;margin-right:-16px;"`)
    } else {
      newAttrs += ' style="width:calc(100% + 32px);height:auto;display:block;margin-left:-16px;margin-right:-16px;"'
    }

    // 4. 添加懒加载属性
    if (!newAttrs.includes('loading=')) {
      newAttrs += ' loading="lazy"'
    }

    return `<img${newAttrs}>`
  })
}

export default function RouteDetail() {
  const [route, setRoute] = useState<any>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const [showBookingPopup, setShowBookingPopup] = useState(false)
  const [bookingInitialDate, setBookingInitialDate] = useState<string | undefined>(undefined)
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadData(Number(id))
    }
  }, [])

  const loadData = async (id: number) => {
    try {
      const [rres, mres, sres] = await Promise.all([
        getRouteDetail(id),
        getMemberCenter().catch(() => ({ data: { is_member: false } })),
        getRouteSchedules(id)
      ])
      setRoute(rres.data || {})
      setIsMember(!!mres.data?.is_member)
      setSchedules(sres.data?.schedules || [])
    } catch (err) {
      console.error(err)
    }
  }

  // 分享
  useShareAppMessage(() => {
    return {
      title: route?.name ? `${route.name} - 尾巴PetWay` : '尾巴PetWay',
      path: `/pages/routes/detail/index?id=${route?.id || ''}`,
      imageUrl: route?.cover_image || '',
    }
  })

  useShareTimeline(() => {
    return {
      title: route?.name ? `${route.name} - 尾巴PetWay` : '尾巴PetWay',
      query: `id=${route?.id || ''}`,
      imageUrl: route?.cover_image || '',
    }
  })

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const scheduleMap = useMemo(() => {
    const map: Record<string, any> = {}
    schedules.forEach(s => {
      if (s.schedule_date) {
        const date = new Date(s.schedule_date + 'T00:00:00')
        if (date >= today) {
          map[s.schedule_date] = s
        }
      }
    })
    return map
  }, [schedules, today])

  const hasAnySchedule = useMemo(() => Object.keys(scheduleMap).length > 0, [scheduleMap])

  // 最近 3 个可用营期，按日期升序
  const upcomingSchedules = useMemo(() => {
    return Object.entries(scheduleMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 3)
      .map(([dateStr, schedule]) => {
        const d = new Date(dateStr + 'T00:00:00')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const week = WEEK_DAYS[d.getDay()]
        const isFull = schedule.status === 2 || schedule.stock <= 0
        let priceText = '免费'
        if (!route?.is_free) {
          const price = getLowestPrice(schedule)
          priceText = price > 0 ? `¥${price}起` : '¥--'
        }
        let stockText = ''
        if (schedule.stock !== undefined && schedule.stock !== null) {
          stockText = isFull ? '已满' : `余${schedule.stock}`
        }
        return { dateStr, month, day, week, priceText, stockText, isFull, schedule }
      })
  }, [scheduleMap, route?.is_free, isMember])

  // 获取该排期所有可用套餐中的最低价（用于日期卡片展示）
  function getLowestPrice(schedule: any) {
    if (!schedule) return 0
    if (route?.is_free) return 0

    const supportsBus = schedule.travel_type !== 2
    const supportsSelfDrive = schedule.travel_type !== 1
    const prices: number[] = []

    if (supportsBus) {
      prices.push(schedule.price)
      prices.push(schedule.single_person_price)
      prices.push(schedule.single_pet_price)
      if (isMember) {
        prices.push(schedule.member_price)
        prices.push(schedule.member_single_person_price)
        prices.push(schedule.member_single_pet_price)
      }
    }

    if (supportsSelfDrive) {
      prices.push(schedule.self_drive_price)
      prices.push(schedule.self_drive_single_person_price)
      if (isMember) {
        prices.push(schedule.member_self_drive_price)
        prices.push(schedule.member_self_drive_single_person_price)
      }
    }

    const validPrices = prices.filter(p => p != null && p > 0)
    return validPrices.length > 0 ? Math.min(...validPrices) : 0
  }

  const handleOpenBooking = (dateStr?: string) => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    if (!hasAnySchedule) {
      Taro.showToast({ title: '当前暂无营期', icon: 'none' })
      return
    }
    setBookingInitialDate(dateStr)
    setShowBookingPopup(true)
  }

  const handleBookingNext = (bookingData: any) => {
    setShowBookingPopup(false)
    const params = new URLSearchParams()
    params.set('routeId', String(route.id))
    params.set('scheduleId', String(bookingData.scheduleId))
    params.set('travelDate', bookingData.travelDate)
    params.set('packageType', bookingData.packageType)
    params.set('basePerson', String(bookingData.basePerson))
    params.set('basePet', String(bookingData.basePet))
    params.set('extraPerson', String(bookingData.extraPerson))
    params.set('extraPet', String(bookingData.extraPet))
    params.set('travelType', bookingData.travelType)
    params.set('addons', JSON.stringify(bookingData.addons))
    params.set('totalPrice', String(bookingData.totalPrice))
    Taro.navigateTo({ url: `/pages/orders/confirm/index?${params.toString()}` })
  }

  const handleNavBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length <= 1) {
      Taro.switchTab({ url: '/pages/index/index' })
    } else {
      safeNavigateBack()
    }
  }

  if (!route) {
    return (
      <View className='route-detail'>
        <View className='loading-wrap'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  const bannerImages = (route.gallery?.length > 0 ? route.gallery : [route.cover_image]).filter(Boolean)
  const images = bannerImages.length > 0 ? bannerImages : ['/assets/images/placeholder-cover.png']

  // 价格展示
  const displayPrice = route.display_price || (
    route.schedule_price !== undefined && route.schedule_price !== null
      ? (route.schedule_price === 0
          ? (route.is_member_only === 1
              ? (isMember ? '会员免费' : `非会员￥${route.non_member_price || 0}起/人`)
              : '免费')
          : (isMember && route.schedule_member_price != null && route.schedule_member_price > 0
              ? `￥${route.schedule_member_price}起/人`
              : `￥${route.schedule_price}起/人`))
      : '暂无营期'
  )

  const footerPrice = route.display_price || (
    hasAnySchedule
      ? (route.schedule_price !== undefined && route.schedule_price !== null
          ? (route.schedule_price === 0
              ? (route.is_member_only === 1
                  ? (isMember ? '会员免费' : `￥${route.non_member_price || 0}起`)
                  : '免费')
              : `￥${route.schedule_price}起`)
          : '暂无营期')
      : '暂无营期'
  )

  return (
    <View className='route-detail'>
      <ScrollView className='detail-scroll' scrollY={!showBookingPopup}>
        {/* Hero 轮播 */}
        <View className='hero-section'>
          <View className='page-back' onClick={handleNavBack}>
            <Text className='page-back-icon'>＜</Text>
          </View>
          {images.length === 1 ? (
            <Image
              className='hero-image'
              src={(images[0].startsWith('http') ? images[0] : `${IMAGE_BASE_URL}${images[0]}`) + '?w=750&q=75'}
              mode='aspectFill'
              lazyLoad
            />
          ) : (
            <Swiper className='hero-swiper' indicatorDots autoplay interval={4000}>
              {images.map((img: string, idx: number) => (
                <SwiperItem key={idx}>
                  <Image
                    className='hero-image'
                    src={(img.startsWith('http') ? img : `${IMAGE_BASE_URL}${img}`) + '?w=750&q=75'}
                    mode='aspectFill'
                    lazyLoad
                  />
                </SwiperItem>
              ))}
            </Swiper>
          )}

        </View>

        {/* 标题与价格 */}
        <View className='title-section'>
          <Text className='route-title'>{route.name}</Text>
          {route.subtitle && <Text className='route-subtitle'>{route.subtitle}</Text>}
          {route.highlights && route.highlights.length > 0 && (
            <View className='tag-row'>
              {route.highlights.map((h: string, idx: number) => (
                <Text key={idx} className='tag-item'>{h}</Text>
              ))}
            </View>
          )}
          <View className='price-row'>
            <Text className='price-current'>{displayPrice}</Text>
            {route.original_price > 0 && (
              <Text className='price-original'>¥{route.original_price}</Text>
            )}
          </View>
        </View>

        {/* 出发日期 */}
        <View className='section-card date-section'>
          <View className='section-header'>
            <View className='section-header-left'>
              <View className='section-accent' />
              <Text className='section-header-title'>出发日期</Text>
            </View>
            <View className='view-all' onClick={() => handleOpenBooking()}>
              <Text className='view-all-text'>查看全部</Text>
              <Text className='view-all-icon'>▼</Text>
            </View>
          </View>
          {upcomingSchedules.length > 0 && (
            <>
              <View className='month-tab'>
                <Text className='month-tab-text'>{Number(upcomingSchedules[0].month)}月</Text>
              </View>
              <ScrollView className='date-scroll' scrollX showScrollbar={false}>
                <View className='date-list'>
                  {upcomingSchedules.map((item, idx) => (
                    <View
                      key={item.dateStr}
                      className={`date-card ${idx === 0 ? 'active' : ''} ${item.isFull ? 'full' : ''}`}
                      onClick={() => !item.isFull && handleOpenBooking(item.dateStr)}
                    >
                      <Text className='date-md'>{item.month}/{item.day}</Text>
                      <View className='date-week-price'>
                        <Text className='date-week'>周{item.week}</Text>
                        <Text className='date-price'>{item.priceText}</Text>
                      </View>
                      {item.stockText && <Text className='date-stock'>{item.stockText}</Text>}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
          {upcomingSchedules.length === 0 && (
            <Text className='empty-date'>当前暂无可用营期</Text>
          )}
        </View>

        {/* 详细介绍 */}
        {route.description ? (
          <View className='section-card section-card-full'>
            <View className='section-header-left section-header-padded'>
              <View className='section-accent' />
              <Text className='section-header-title'>详细介绍</Text>
            </View>
            <RichText className='rich-text rich-text-full' nodes={processRichText(route.description)} />
          </View>
        ) : null}

        {/* 活动亮点 */}
        {route.highlights_detail ? (
          <View className='section-card section-card-full'>
            <View className='section-header-left section-header-padded'>
              <View className='section-accent' />
              <Text className='section-header-title'>活动亮点</Text>
            </View>
            <RichText className='rich-text rich-text-full' nodes={processRichText(route.highlights_detail)} />
          </View>
        ) : null}

        {/* 费用说明 */}
        {(!route.is_free || route.is_insurance_required === 1) && (route.fee_description || route.fee_include || route.fee_exclude) ? (
          <View className='section-card section-card-full'>
            <View className='section-header-left section-header-padded'>
              <View className='section-accent' />
              <Text className='section-header-title'>费用说明</Text>
            </View>
            {route.fee_description && (
              <View className='fee-block'>
                <Text className='fee-label'>费用说明概述</Text>
                <RichText className='rich-text rich-text-full' nodes={processRichText(route.fee_description)} />
              </View>
            )}
            {route.fee_include && (
              <View className='fee-block'>
                <Text className='fee-label'>费用包含</Text>
                <RichText className='rich-text rich-text-full' nodes={processRichText(route.fee_include)} />
              </View>
            )}
            {route.fee_exclude && (
              <View className='fee-block'>
                <Text className='fee-label'>费用不包含</Text>
                <RichText className='rich-text rich-text-full' nodes={processRichText(route.fee_exclude)} />
              </View>
            )}
          </View>
        ) : null}

        {/* 注意事项 */}
        {(!route.is_free || route.is_insurance_required === 1) && route.notice ? (
          <View className='section-card section-card-full'>
            <View className='section-header-left section-header-padded'>
              <View className='section-accent' />
              <Text className='section-header-title'>注意事项</Text>
            </View>
            <RichText className='rich-text rich-text-full' nodes={processRichText(route.notice)} />
          </View>
        ) : null}

        {/* 底部安全占位 */}
        <View className='safe-bottom' />
      </ScrollView>

      {/* 底部预订栏 */}
      <View className='booking-bar'>
        <View className='booking-bar-price'>
          <Text className='booking-price-main'>{footerPrice}</Text>
          {route.original_price > 0 && (
            <Text className='booking-price-original'>原价 ¥{route.original_price}</Text>
          )}
        </View>
        {hasAnySchedule ? (
          <View className='booking-btn' onClick={() => handleOpenBooking()}>
            {route?.is_free ? '免费报名' : '立即预订'}
          </View>
        ) : (
          <View className='booking-btn disabled'>暂无营期</View>
        )}
      </View>

      <BookingPopup
        visible={showBookingPopup}
        route={route}
        schedules={schedules}
        initialDate={bookingInitialDate}
        onClose={() => setShowBookingPopup(false)}
        onNext={handleBookingNext}
      />
    </View>
  )
}

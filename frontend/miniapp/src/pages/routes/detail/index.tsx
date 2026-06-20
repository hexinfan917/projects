import { useEffect, useState, useMemo } from 'react'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { View, Text, Image, ScrollView, Button, RichText, Swiper, SwiperItem } from '@tarojs/components'
import { getRouteDetail, getRouteSchedules, getMemberCenter, IMAGE_BASE_URL, safeNavigateBack } from '../../../utils/api'
import BookingPopup from '../../../components/BookingPopup'
import './index.scss'

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']
const FILE_BASE_URL = IMAGE_BASE_URL

/** 处理富文本中的图片：补全相对路径 + 自适应样式 */
function processRichText(html: string): string {
  if (!html) return ''
  return html.replace(/<img([^>]*?)>/gi, (match: string, attrs: string) => {
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

    // 3. 处理 style 属性：移除 width/height，添加自适应
    const styleMatch = newAttrs.match(/style\s*=\s*"([^"]*)"/i)
    if (styleMatch) {
      let styleValue = styleMatch[1]
        .replace(/\bwidth\s*:\s*[^;]+;?/gi, '')
        .replace(/\bheight\s*:\s*[^;]+;?/gi, '')
        .replace(/;+/g, ';')
        .replace(/^;|;$/g, '')
      newAttrs = newAttrs.replace(/style\s*=\s*"[^"]*"/i, `style="${styleValue};max-width:100%;height:auto;display:block;"`)
    } else {
      newAttrs += ' style="max-width:100%;height:auto;display:block;"'
    }

    // 4. 添加懒加载属性
    if (!newAttrs.includes('loading=')) {
      newAttrs += ' loading="lazy"'
    }

    return `<img${newAttrs}>`
  })
}

function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < startWeek; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)
  return days
}

export default function RouteDetail() {
  const [route, setRoute] = useState<any>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [showBookingPopup, setShowBookingPopup] = useState(false)
  const [isMember, setIsMember] = useState(false)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadData(Number(id))
    }
  }, [])

  const loadData = async (id: number) => {
    try {
      const [rres, mres] = await Promise.all([
        getRouteDetail(id),
        getMemberCenter().catch(() => ({ data: { is_member: false } }))
      ])
      setRoute(rres.data || {})
      setIsMember(!!mres.data?.is_member)
      const sres = await getRouteSchedules(id)
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

  const calendarDays = useMemo(() => generateCalendarDays(year, month), [year, month])

  const availableCount = useMemo(() => {
    return calendarDays.filter(d => d && scheduleMap[`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`]).length
  }, [calendarDays, scheduleMap, year, month])

  const hasAnySchedule = useMemo(() => Object.keys(scheduleMap).length > 0, [scheduleMap])

  // 提取所有有营期的月份（YYYY-MM 格式，已排序）
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    Object.keys(scheduleMap).forEach(dateStr => {
      const [y, m] = dateStr.split('-')
      monthSet.add(`${y}-${m}`)
    })
    return Array.from(monthSet).sort().map(str => {
      const [y, m] = str.split('-').map(Number)
      return { year: y, month: m }
    })
  }, [scheduleMap])

  const handleOpenCalendar = () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    if (!hasAnySchedule) {
      Taro.showToast({ title: '当前暂无营期', icon: 'none' })
      return
    }
    setShowBookingPopup(true)
  }

  const handleSelectDate = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const schedule = scheduleMap[dateStr]
    if (!schedule) return
    setSelectedDay(day)
    setTimeout(() => {
      setShowCalendar(false)
      Taro.navigateTo({ url: `/pages/orders/confirm/index?routeId=${route.id}&scheduleId=${schedule.id}` })
    }, 150)
  }

  const handleBookingNext = (bookingData: any) => {
    setShowBookingPopup(false)
    // 携带弹窗选择的数据跳转到订单确认页
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

  const monthTitle = `${year}年${month}月`

  if (!route) {
    return <View className='route-detail'><Text>加载中...</Text></View>
  }

  const bannerImages = (route.gallery?.length > 0 ? route.gallery : [route.cover_image]).filter(Boolean)
  const images = bannerImages.length > 0 ? bannerImages : ['/assets/images/placeholder-cover.png']

  return (
    <View className='route-detail' style={{ paddingTop: '140rpx' }}>
      <View className='page-back' onClick={() => {
        const pages = Taro.getCurrentPages()
        if (pages.length <= 1) {
          Taro.switchTab({ url: '/pages/index/index' })
        } else {
          safeNavigateBack()
        }
      }}>
        <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
      </View>
      <ScrollView className='detail-scroll' scrollY={!showBookingPopup}>
        {images.length === 1 ? (
          <Image
            className='cover-image'
            src={(images[0].startsWith('http') ? images[0] : `${IMAGE_BASE_URL}${images[0]}`) + '?w=750&q=75'}
            mode='aspectFill'
            lazyLoad
            onError={() => console.warn('封面图加载失败:', images[0])}
          />
        ) : (
          <Swiper className='cover-swiper' indicatorDots autoplay interval={4000}>
            {images.map((img: string, idx: number) => (
              <SwiperItem key={idx}>
                <Image
                  className='cover-image'
                  src={(img.startsWith('http') ? img : `${IMAGE_BASE_URL}${img}`) + '?w=750&q=75'}
                  mode='aspectFill'
                  lazyLoad
                  onError={() => console.warn('轮播图加载失败:', img)}
                />
              </SwiperItem>
            ))}
          </Swiper>
        )}

        <View className='info-card'>
          <Text className='route-name'>{route.name}</Text>
          {route.subtitle && <Text className='route-subtitle'>{route.subtitle}</Text>}
          {route.highlights && route.highlights.length > 0 && (
            <View className='highlights-row'>
              {route.highlights.map((h: string, idx: number) => (
                <Text key={idx} className='highlight-tag'>{h}</Text>
              ))}
            </View>
          )}
          <Text className='route-price'>
            {route.display_price || (
              route.schedule_price !== undefined && route.schedule_price !== null
                ? (route.schedule_price === 0
                    ? (route.is_member_only === 1
                        ? (isMember ? '会员免费' : `非会员￥${route.non_member_price || 0}起/人`)
                        : '免费')
                    : (isMember && route.schedule_member_price != null && route.schedule_member_price > 0
                        ? `￥${route.schedule_member_price}起/人`
                        : `￥${route.schedule_price}起/人`))
                : '暂无营期'
            )}
          </Text>
          {route.is_free === 1 && route.is_member_only === 1 && (
            <View className='highlights-row' style={{ marginTop: '12rpx' }}>
              <Text className='highlight-tag' style={{ background: '#FFF7E6', color: '#D48806', border: '1rpx solid #FFD591' }}>会员专享免费</Text>
            </View>
          )}
          {/* 保险价格标签已移除 */}
        </View>

        {route.description ? (
          <View className='section'>
            <Text className='section-title'>详细介绍</Text>
            <RichText className='rich-text' nodes={processRichText(route.description)} />
          </View>
        ) : null}

        {route.highlights_detail ? (
          <View className='section'>
            <Text className='section-title'>活动亮点</Text>
            <RichText className='rich-text' nodes={processRichText(route.highlights_detail)} />
          </View>
        ) : null}

        {(!route.is_free || route.is_insurance_required === 1) && (route.fee_description || route.fee_include || route.fee_exclude) ? (
          <View className='section'>
            <Text className='section-title'>费用说明</Text>
            {route.fee_description && (
              <View className='fee-block'>
                <Text className='fee-label'>费用说明概述</Text>
                <RichText className='rich-text' nodes={processRichText(route.fee_description)} />
              </View>
            )}
            {route.fee_include && (
              <View className='fee-block'>
                <Text className='fee-label'>费用包含</Text>
                <RichText className='rich-text' nodes={processRichText(route.fee_include)} />
              </View>
            )}
            {route.fee_exclude && (
              <View className='fee-block'>
                <Text className='fee-label'>费用不包含</Text>
                <RichText className='rich-text' nodes={processRichText(route.fee_exclude)} />
              </View>
            )}
          </View>
        ) : null}

        {(!route.is_free || route.is_insurance_required === 1) && route.notice ? (
          <View className='section'>
            <Text className='section-title'>注意事项</Text>
            <RichText className='rich-text' nodes={processRichText(route.notice)} />
          </View>
        ) : null}

        </ScrollView>

      <View className='detail-footer'>
        <View className='footer-left'>
          <Text className='footer-price'>
            {route.display_price || (
              hasAnySchedule
                ? (route.schedule_price !== undefined && route.schedule_price !== null
                    ? (route.schedule_price === 0
                        ? (route.is_member_only === 1
                            ? (isMember ? '会员免费' : `￥${route.non_member_price || 0}起`)
                            : '免费')
                        : `￥${route.schedule_price}起`)
                    : '暂无营期')
                : '暂无营期'
            )}
          </Text>
        </View>
        {hasAnySchedule ? (
          <View className='book-btn' onClick={handleOpenCalendar}>
            {route?.is_free ? '免费报名' : '立即预订'}
          </View>
        ) : (
          <View className='book-btn disabled'>暂无营期</View>
        )}
      </View>

      {showCalendar && (
        <View className='calendar-modal'>
          <View className='calendar-mask' onClick={() => setShowCalendar(false)} />
          <View className='calendar-content'>
            <View className='calendar-header'>
              <Text className='calendar-title'>选择营期日期</Text>
              <Text className='calendar-close' onClick={() => setShowCalendar(false)}>✕</Text>
            </View>

            <Text className='calendar-month'>{monthTitle}</Text>

            <View className='calendar-weekdays'>
              {WEEK_DAYS.map(d => (
                <Text key={d} className='weekday-cell'>{d}</Text>
              ))}
            </View>

            <View className='calendar-days'>
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} className='day-cell empty' />
                }
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const schedule = scheduleMap[dateStr]
                const hasSchedule = !!schedule
                const isSelected = selectedDay === day
                return (
                  <View
                    key={day}
                    className={`day-cell ${hasSchedule ? 'available' : 'disabled'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => hasSchedule && handleSelectDate(day)}
                  >
                    <Text className='day-num'>{day}</Text>
                    {hasSchedule && (
                      <Text className='day-price'>
                        {schedule.price === 0
                          ? (route.is_member_only === 1
                              ? (isMember ? '会员免费' : `￥${schedule.non_member_price || route.non_member_price || 0}`)
                              : '免费')
                          : (isMember
                              ? (schedule.travel_type === 2
                                ? (schedule.member_self_drive_price != null ? `￥${schedule.member_self_drive_price}` : `￥${schedule.self_drive_price || 0}`)
                                : (schedule.member_price != null ? `￥${schedule.member_price}` : `￥${schedule.price}`))
                              : (schedule.travel_type === 2 ? `￥${schedule.self_drive_price || 0}` : `￥${schedule.price}`))}
                      </Text>
                    )}
                    {isSelected && <Text className='selected-tag'>出发</Text>}
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      )}



      <BookingPopup
        visible={showBookingPopup}
        route={route}
        schedules={schedules}
        onClose={() => setShowBookingPopup(false)}
        onNext={handleBookingNext}
      />
    </View>
  )
}

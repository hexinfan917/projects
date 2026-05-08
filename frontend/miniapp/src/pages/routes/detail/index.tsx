import { useEffect, useState, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView, Button, RichText, Swiper, SwiperItem } from '@tarojs/components'
import { getRouteDetail, getRouteSchedules, getRouteAddons } from '../../../utils/api'
import './index.scss'

/* ---------- 酒店房型详情弹窗组件 ---------- */
function HotelRoomModal({ room, visible, onClose }: any) {
  if (!visible || !room) return null
  const images = room.images?.length > 0 ? room.images : ['https://via.placeholder.com/750x420']
  return (
    <View className='room-modal' onClick={onClose}>
      <View className='room-modal-mask' />
      <View className='room-modal-content' onClick={(e) => e.stopPropagation()}>
        <View className='room-modal-header'>
          <Text className='room-modal-title'>基本信息</Text>
          <Text className='room-modal-close' onClick={onClose}>✕</Text>
        </View>
        <ScrollView className='room-modal-scroll' scrollY>
          {images.length === 1 ? (
            <Image className='room-modal-image' src={images[0]} mode='aspectFill' />
          ) : (
            <Swiper className='room-modal-swiper' indicatorDots autoplay interval={4000}>
              {images.map((img: string, idx: number) => (
                <SwiperItem key={idx}>
                  <Image className='room-modal-image' src={img} mode='aspectFill' />
                </SwiperItem>
              ))}
            </Swiper>
          )}
          <View className='room-modal-body'>
            <Text className='room-modal-name'>{room.name}</Text>
            <View className='room-modal-specs'>
              {room.max_guests ? <Text className='room-modal-spec'>至多{room.max_guests}人</Text> : null}
              {room.area ? <Text className='room-modal-spec'>面积{room.area}</Text> : null}
              {room.bed_type ? <Text className='room-modal-spec'>{room.bed_type}</Text> : null}
            </View>
            <View className='room-modal-section'>
              <Text className='room-modal-section-title'>预定必读</Text>
              {room.breakfast ? (
                <View className='room-modal-info-row'>
                  <Text className='room-modal-info-label'>早餐</Text>
                  <Text className='room-modal-info-value'>{room.breakfast}</Text>
                </View>
              ) : null}
              {room.max_pets !== undefined ? (
                <View className='room-modal-info-row'>
                  <Text className='room-modal-info-label'>携宠数量</Text>
                  <Text className='room-modal-info-value'>至多{room.max_pets}只宠物</Text>
                </View>
              ) : null}
              {room.pet_weight_limit ? (
                <View className='room-modal-info-row'>
                  <Text className='room-modal-info-label'>携宠体重</Text>
                  <Text className='room-modal-info-value'>{room.pet_weight_limit}</Text>
                </View>
              ) : null}
              {room.cancel_policy ? (
                <View className='room-modal-info-row'>
                  <Text className='room-modal-info-label'>退订政策</Text>
                  <Text className='room-modal-info-value'>{room.cancel_policy}</Text>
                </View>
              ) : null}
              {room.checkin_notes ? (
                <View className='room-modal-info-row'>
                  <Text className='room-modal-info-label'>入住必读</Text>
                  <Text className='room-modal-info-value'>{room.checkin_notes}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']
const FILE_BASE_URL = 'http://localhost:8081'

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
        newAttrs = newAttrs.replace(srcMatch[0], `src="${fullSrc}"`)
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
  const [addons, setAddons] = useState<any[]>([])
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const [activeHotelFilter, setActiveHotelFilter] = useState<string>('全部')
  const [selectedRoom, setSelectedRoom] = useState<any>(null)

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
      const res = await getRouteDetail(id)
      setRoute(res.data || {})
      const sres = await getRouteSchedules(id)
      setSchedules(sres.data?.schedules || [])
      const ares = await getRouteAddons(id)
      setAddons(ares.data?.addons || [])
    } catch (err) {
      console.error(err)
    }
  }

  const scheduleMap = useMemo(() => {
    const map: Record<string, any> = {}
    schedules.forEach(s => {
      if (s.schedule_date) {
        map[s.schedule_date] = s
      }
    })
    return map
  }, [schedules])

  const calendarDays = useMemo(() => generateCalendarDays(year, month), [year, month])

  const availableCount = useMemo(() => {
    return calendarDays.filter(d => d && scheduleMap[`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`]).length
  }, [calendarDays, scheduleMap, year, month])

  const handleOpenCalendar = () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    if (availableCount === 0) {
      Taro.showToast({ title: '当月暂无营期', icon: 'none' })
      return
    }
    setShowCalendar(true)
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

  const monthTitle = `${year}年${month}月`

  if (!route) {
    return <View className='route-detail'><Text>加载中...</Text></View>
  }

  const bannerImages = (route.gallery?.length > 0 ? route.gallery : [route.cover_image]).filter(Boolean)
  const images = bannerImages.length > 0 ? bannerImages : ['https://via.placeholder.com/750x420']

  return (
    <View className='route-detail' style={{ paddingTop: '140rpx' }}>
      <View className='page-back' onClick={() => Taro.navigateBack()}>
        <Text className='page-back-icon'>←</Text>
      </View>
      <ScrollView className='detail-scroll' scrollY>
        {images.length === 1 ? (
          <Image className='cover-image' src={images[0].startsWith('http') ? images[0] : `http://localhost:8081${images[0]}`} mode='aspectFill' />
        ) : (
          <Swiper className='cover-swiper' indicatorDots autoplay interval={4000}>
            {images.map((img: string, idx: number) => (
              <SwiperItem key={idx}>
                <Image className='cover-image' src={img.startsWith('http') ? img : `http://localhost:8081${img}`} mode='aspectFill' />
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
          <Text className='route-price'>￥{route.base_price}起/人</Text>
        </View>

        {route.description ? (
          <View className='section'>
            <Text className='section-title'>详细介绍</Text>
            <RichText className='rich-text' nodes={processRichText(route.description)} />
          </View>
        ) : null}

        {route.highlights_detail ? (
          <View className='section'>
            <Text className='section-title'>行程亮点</Text>
            <RichText className='rich-text' nodes={processRichText(route.highlights_detail)} />
          </View>
        ) : null}

        {(route.fee_description || route.fee_include || route.fee_exclude) ? (
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

        {route.notice ? (
          <View className='section'>
            <Text className='section-title'>注意事项</Text>
            <RichText className='rich-text' nodes={processRichText(route.notice)} />
          </View>
        ) : null}

        {addons.length > 0 && (
          <View className='section'>
            <Text className='section-title'>可选资源</Text>
            {addons.map((addon: any) => {
              const categoryLabel = addon.category === 'dog_ticket' ? '狗狗票' : addon.category === 'hotel' ? '酒店' : addon.category === 'amusement' ? '游乐项目' : addon.category
              // 酒店：收集所有过滤标签
              let hotelFilterTags: string[] = []
              let filteredRooms: any[] = []
              if (addon.category === 'hotel' && addon.extra_config?.rooms?.length > 0) {
                const allFilters = new Set<string>()
                addon.extra_config.rooms.forEach((r: any) => {
                  r.filters?.forEach((f: string) => allFilters.add(f))
                })
                hotelFilterTags = ['全部', ...Array.from(allFilters)]
                filteredRooms = activeHotelFilter === '全部'
                  ? addon.extra_config.rooms
                  : addon.extra_config.rooms.filter((r: any) => r.filters?.includes(activeHotelFilter))
              }
              return (
                <View key={addon.id} className='addon-category-block'>
                  <Text className='addon-category-title'>{categoryLabel}</Text>
                  {/* 酒店房型展示 */}
                  {addon.category === 'hotel' && addon.extra_config?.rooms?.length > 0 ? (
                    <View>
                      {/* 过滤标签 */}
                      {hotelFilterTags.length > 1 && (
                        <View className='hotel-filter-bar'>
                          <ScrollView scrollX className='hotel-filter-scroll'>
                            {hotelFilterTags.map((tag) => (
                              <Text
                                key={tag}
                                className={`hotel-filter-tag ${activeHotelFilter === tag ? 'active' : ''}`}
                                onClick={() => setActiveHotelFilter(tag)}
                              >
                                {tag}
                              </Text>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                      <View className='hotel-rooms-list'>
                        {filteredRooms.map((room: any, idx: number) => (
                          <View key={idx} className='hotel-room-card' onClick={() => setSelectedRoom(room)}>
                            <View className='hotel-room-left'>
                              <Image
                                className='hotel-room-image'
                                src={room.images?.[0] || 'https://via.placeholder.com/200x150'}
                                mode='aspectFill'
                              />
                            </View>
                            <View className='hotel-room-right'>
                              <Text className='hotel-room-name'>{room.name}</Text>
                              <View className='hotel-room-tags'>
                                {room.tags?.map((t: string, i: number) => (
                                  <Text key={i} className='hotel-room-tag'>{t}</Text>
                                ))}
                              </View>
                              <View className='hotel-room-specs'>
                                {room.area ? <Text className='hotel-room-spec'>{room.area}</Text> : null}
                                {room.window ? <Text className='hotel-room-spec'>{room.window}</Text> : null}
                                {room.max_guests ? <Text className='hotel-room-spec'>至多{room.max_guests}人{room.max_pets ? `/${room.max_pets}宠` : ''}</Text> : null}
                                {room.bed_type ? <Text className='hotel-room-spec'>{room.bed_type}</Text> : null}
                              </View>
                              {room.cancel_policy ? (
                                <Text className='hotel-room-policy'>{room.cancel_policy}</Text>
                              ) : null}
                              <View className='hotel-room-footer'>
                                <View className='hotel-room-filters'>
                                  {room.filters?.map((f: string, i: number) => (
                                    <Text key={i} className='hotel-room-filter'>{f}</Text>
                                  ))}
                                </View>
                              </View>
                              {room.breakfast ? (
                                <View className='hotel-room-breakfast'>
                                  <Text className='hotel-room-breakfast-icon'>食</Text>
                                  <Text className='hotel-room-breakfast-text'>{room.breakfast}</Text>
                                </View>
                              ) : null}
                            </View>
                            <View className='hotel-room-book'>
                              {room.stock !== undefined ? (
                                <Text className='hotel-room-stock'>仅剩{room.stock}间</Text>
                              ) : null}
                              <View className='hotel-room-price-row'>
                                {room.original_price ? (
                                  <Text className='hotel-room-original-price'>¥{room.original_price}</Text>
                                ) : null}
                                <Text className='hotel-room-price'>¥{room.price}</Text>
                              </View>
                              <View className='hotel-room-book-btn'>预订</View>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : addon.extra_config?.options?.length > 0 ? (
                  <View className='addon-options-list'>
                    {addon.extra_config.options.map((opt: any, idx: number) => (
                      <View key={idx} className='addon-option-item'>
                        <View className='addon-option-info'>
                          <Text className='addon-option-name'>{opt.name}</Text>
                          {opt.description ? <Text className='addon-option-desc'>{opt.description}</Text> : null}
                        </View>
                        <Text className='addon-option-price'>¥{opt.price}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className='addon-simple-item'>
                    <Text className='addon-simple-name'>{addon.name}</Text>
                    <Text className='addon-simple-price'>¥{addon.price}/{addon.unit || '份'}</Text>
                  </View>
                )}
              </View>
            )})}
          </View>
        )}
      </ScrollView>

      <View className='detail-footer'>
        <View className='footer-left'>
          <Text className='footer-price'>￥{route.base_price}起</Text>
        </View>
        <Button className='book-btn' onClick={handleOpenCalendar}>立即预订</Button>
      </View>

      <HotelRoomModal room={selectedRoom} visible={!!selectedRoom} onClose={() => setSelectedRoom(null)} />

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
                      <Text className='day-price'>￥{schedule.price}</Text>
                    )}
                    {isSelected && <Text className='selected-tag'>出发</Text>}
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

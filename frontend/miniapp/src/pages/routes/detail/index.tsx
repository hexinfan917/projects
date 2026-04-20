import { useEffect, useState, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView, Button, RichText } from '@tarojs/components'
import { getRouteDetail, getRouteSchedules } from '../../../utils/api'
import './index.scss'

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']

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

  return (
    <View className='route-detail'>
      <ScrollView className='detail-scroll' scrollY>
        <Image className='cover-image' src={route.cover_image || 'https://via.placeholder.com/750x420'} mode='aspectFill' />

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
          <View className='tags-row'>
            <Text className='tag'>评分 {route.rating || 4.8}</Text>
            <Text className='tag'>已售 {route.sold || 0}</Text>
          </View>
          <Text className='route-price'>￥{route.base_price}起/人</Text>
        </View>

        {route.description ? (
          <View className='section'>
            <Text className='section-title'>详细介绍</Text>
            <RichText className='rich-text' nodes={route.description} />
          </View>
        ) : null}

        {route.highlights_detail ? (
          <View className='section'>
            <Text className='section-title'>行程亮点</Text>
            <RichText className='rich-text' nodes={route.highlights_detail} />
          </View>
        ) : null}

        {(route.fee_description || route.fee_include || route.fee_exclude) ? (
          <View className='section'>
            <Text className='section-title'>费用说明</Text>
            {route.fee_description && (
              <View className='fee-block'>
                <Text className='fee-label'>费用说明概述</Text>
                <RichText className='rich-text' nodes={route.fee_description} />
              </View>
            )}
            {route.fee_include && (
              <View className='fee-block'>
                <Text className='fee-label'>费用包含</Text>
                <RichText className='rich-text' nodes={route.fee_include} />
              </View>
            )}
            {route.fee_exclude && (
              <View className='fee-block'>
                <Text className='fee-label'>费用不包含</Text>
                <RichText className='rich-text' nodes={route.fee_exclude} />
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View className='detail-footer'>
        <View className='footer-left'>
          <Text className='footer-price'>￥{route.base_price}起</Text>
        </View>
        <Button className='book-btn' onClick={handleOpenCalendar}>立即预订</Button>
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

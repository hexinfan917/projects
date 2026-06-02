import { useEffect, useState, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components'
import { getRouteDetail, getRouteSchedules, getPets, getTravelers, createOrder, getRouteAddons, getAddonCategories, getAvailableCoupons, calculateCoupon, getAgreements, compressImageUrl } from '../../../utils/api'
import './index.scss'

const GENDER_MAP: any = { 0: '母', 1: '公' }

function calcAge(birthDate?: string) {
  if (!birthDate) return '-'
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age > 0 ? age : '-'
}

function formatAge(ageStr?: string) {
  if (!ageStr) return ''
  const s = ageStr.trim()
  if (!s) return ''
  if (/[岁半]/.test(s)) return s
  return s + '岁'
}

function maskPhone(phone?: string) {
  if (!phone || phone.length < 7) return phone || '-'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

function maskIdCard(idCard?: string) {
  if (!idCard || idCard.length < 8) return idCard || '-'
  return idCard.slice(0, 3) + '***********' + idCard.slice(-4)
}

const PACKAGE_OPTIONS = [
  { key: 'couple', label: '一人一宠', priceField: 'base_price', basePerson: 1, basePet: 1 },
  { key: 'one_person_two_pet', label: '一人两宠', priceField: 'one_person_two_pet_price', basePerson: 1, basePet: 2 },
  { key: 'two_person_one_pet', label: '二人一宠', priceField: 'two_person_one_pet_price', basePerson: 2, basePet: 1 },
  { key: 'single_person', label: '单人轻旅（无宠）', priceField: 'single_person_price', basePerson: 1, basePet: 0 },
  { key: 'single_pet', label: '毛孩专属接送（无主人陪同）', priceField: 'single_pet_price', basePerson: 0, basePet: 1 },
]

/* ---------- 酒店房型详情弹窗 ---------- */
function HotelRoomModal({ room, visible, onClose }: any) {
  if (!visible || !room) return null
  const images = room.images?.length > 0 ? room.images.map((url: string) => compressImageUrl(url, 750)) : ['https://via.placeholder.com/750x420']
  return (
    <View className='room-modal-confirm' onClick={onClose}>
      <View className='room-modal-mask-confirm' />
      <View className='room-modal-content-confirm' onClick={(e) => e.stopPropagation()}>
        <View className='room-modal-header-confirm'>
          <Text className='room-modal-title-confirm'>基本信息</Text>
          <Text className='room-modal-close-confirm' onClick={onClose}>✕</Text>
        </View>
        <ScrollView className='room-modal-scroll-confirm' scrollY>
          {images.length === 1 ? (
            <Image className='room-modal-image-confirm' src={images[0]} mode='aspectFill' />
          ) : (
            <Swiper className='room-modal-swiper-confirm' indicatorDots autoplay interval={4000}>
              {images.map((img: string, idx: number) => (
                <SwiperItem key={idx}>
                  <Image className='room-modal-image-confirm' src={img} mode='aspectFill' />
                </SwiperItem>
              ))}
            </Swiper>
          )}
          <View className='room-modal-body-confirm'>
            <Text className='room-modal-name-confirm'>{room.name}</Text>
            <View className='room-modal-specs-confirm'>
              {room.max_guests ? <Text className='room-modal-spec-confirm'>至多{room.max_guests}人</Text> : null}
              {room.area ? <Text className='room-modal-spec-confirm'>面积{room.area}</Text> : null}
              {room.bed_type ? <Text className='room-modal-spec-confirm'>{room.bed_type}</Text> : null}
              {room.window ? <Text className='room-modal-spec-confirm'>{room.window}</Text> : null}
            </View>
            <View className='room-modal-section-confirm'>
              <Text className='room-modal-section-title-confirm'>预定必读</Text>
              {room.breakfast ? (
                <View className='room-modal-info-row-confirm'>
                  <Text className='room-modal-info-label-confirm'>早餐</Text>
                  <Text className='room-modal-info-value-confirm'>{room.breakfast}</Text>
                </View>
              ) : null}
              {room.max_pets !== undefined ? (
                <View className='room-modal-info-row-confirm'>
                  <Text className='room-modal-info-label-confirm'>携宠数量</Text>
                  <Text className='room-modal-info-value-confirm'>至多{room.max_pets}只宠物</Text>
                </View>
              ) : null}
              {room.pet_weight_limit ? (
                <View className='room-modal-info-row-confirm'>
                  <Text className='room-modal-info-label-confirm'>携宠体重</Text>
                  <Text className='room-modal-info-value-confirm'>{room.pet_weight_limit}</Text>
                </View>
              ) : null}
              {room.cancel_policy ? (
                <View className='room-modal-info-row-confirm'>
                  <Text className='room-modal-info-label-confirm'>退订政策</Text>
                  <Text className='room-modal-info-value-confirm'>{room.cancel_policy}</Text>
                </View>
              ) : null}
              {room.checkin_notes ? (
                <View className='room-modal-info-row-confirm'>
                  <Text className='room-modal-info-label-confirm'>入住必读</Text>
                  <Text className='room-modal-info-value-confirm'>{room.checkin_notes}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

export default function OrderConfirm() {
  const [route, setRoute] = useState<any>(null)
  const [schedule, setSchedule] = useState<any>(null)
  const [travelers, setTravelers] = useState<any[]>([])
  const [selectedTravelerIds, setSelectedTravelerIds] = useState<number[]>([])
  const [pets, setPets] = useState<any[]>([])
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([])
  const [showTravelerModal, setShowTravelerModal] = useState(false)
  const [showPetModal, setShowPetModal] = useState(false)

  // 行程选配
  const [addonTabs, setAddonTabs] = useState<any[]>([])
  const [addons, setAddons] = useState<any[]>([])
  const [activeAddonTab, setActiveAddonTab] = useState('')
  const [addonQuantities, setAddonQuantities] = useState<Record<number, number>>({})
  // 狗狗票选项数量：{ addonId: { optionName: quantity } }
  const [addonOptionQuantities, setAddonOptionQuantities] = useState<Record<number, Record<string, number>>>({})
  // 酒店房型数量：{ addonId: { roomName: quantity } }
  const [addonRoomQuantities, setAddonRoomQuantities] = useState<Record<number, Record<string, number>>>({})
  const [selectedRoom, setSelectedRoom] = useState<any>(null)

  // 优惠券
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([])
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [showPriceDetail, setShowPriceDetail] = useState(false)
  const [agreements, setAgreements] = useState<any[]>([])
  const [agreed, setAgreed] = useState(false)

  // 从弹窗传入的参数
  const [bookingParams, setBookingParams] = useState<any>(null)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const params = instance.router?.params
    const routeId = params?.routeId
    const scheduleId = params?.scheduleId

    // 解析弹窗传入的参数
    const bp: any = {
      routeId: routeId ? Number(routeId) : 0,
      scheduleId: scheduleId ? Number(scheduleId) : 0,
      travelDate: params?.travelDate || '',
      packageType: params?.packageType || 'couple',
      basePerson: Number(params?.basePerson || 1),
      basePet: Number(params?.basePet || 1),
      extraPerson: Number(params?.extraPerson || 0),
      extraPet: Number(params?.extraPet || 0),
      travelType: params?.travelType || 'bus',
      addons: (() => {
        try {
          return params?.addons ? JSON.parse(decodeURIComponent(params.addons)) : []
        } catch (e) {
          console.error('解析 addons 失败:', e)
          return []
        }
      })(),
      totalPrice: Number(params?.totalPrice || 0),
    }
    setBookingParams(bp)

    if (routeId) {
      loadRouteData(Number(routeId), Number(scheduleId), bp)
    }
    loadAgreements()
  }, [])

  const loadAgreements = async () => {
    try {
      const res = await getAgreements()
      if (res.code === 200) {
        const list = res.data?.list || []
        // 订单提交页只显示与订单相关的协议，排除用户协议和隐私政策
        const filtered = list.filter((a: any) => a.type !== 'user_agreement' && a.type !== 'privacy_policy')
        setAgreements(filtered)
      }
    } catch (e: any) {
      // 接口未就绪时静默处理，不影响下单流程
      if (e?.statusCode !== 404 && !e?.message?.includes('Not Found')) {
        console.error('load agreements error', e)
      }
      setAgreements([])
    }
  }

  useDidShow(() => {
    loadTravelers()
    loadPets()
  })

  const loadRouteData = async (routeId: number, scheduleId: number, bp?: any) => {
    try {
      const rres = await getRouteDetail(routeId)
      setRoute(rres.data || {})
      const sres = await getRouteSchedules(routeId)
      const schedules = sres.data?.schedules || []
      const found = schedules.find((s: any) => String(s.id) === String(scheduleId))
      setSchedule(found || null)
      // 加载行程选配分类
      const cres = await getAddonCategories()
      const catList = cres.data?.categories || []
      const tabs = catList.filter((c: any) => c.status === 1).map((c: any) => ({ key: c.code, label: c.name }))
      setAddonTabs(tabs)
      if (tabs.length > 0 && !activeAddonTab) {
        setActiveAddonTab(tabs[0].key)
      }
      // 加载行程选配
      const ares = await getRouteAddons(routeId)
      const addonList = ares.data?.addons || []
      setAddons(addonList)
      // 从 bookingParams 恢复已选数量，必选项默认数量为1
      const defaultQty: Record<number, number> = {}
      const defaultOptionQty: Record<number, Record<string, number>> = {}
      const defaultRoomQty: Record<number, Record<string, number>> = {}
      // 恢复从路线详情页传入的 addon 数量
      const preAddons = bookingParams?.addons || []
      preAddons.forEach((a: any) => {
        const id = a.addon_id || a.id
        if (id) {
          defaultQty[id] = a.quantity || 1
        }
      })
      addonList.forEach((a: any) => {
        if (a.is_required && !defaultQty[a.id]) {
          if (a.category === 'dog_ticket' && a.extra_config?.options?.length > 0) {
            // 有选项的狗狗票，默认不选任何选项
          } else if (a.category === 'hotel' && a.extra_config?.rooms?.length > 0) {
            // 有房型的酒店，默认不选任何房型
          } else {
            defaultQty[a.id] = 1
          }
        }
      })
      setAddonQuantities(defaultQty)
      setAddonOptionQuantities(defaultOptionQty)
      setAddonRoomQuantities(defaultRoomQty)
    } catch (err) {
      console.error(err)
    }
  }

  const loadTravelers = async () => {
    try {
      const res = await getTravelers()
      const list = res.data || []
      setTravelers(list)
      // 若之前有选中但已被删除的 ID，自动清理
      setSelectedTravelerIds(prev => {
        const cleaned = prev.filter(id => list.some((t: any) => t.id === id))
        if (cleaned.length === 0) {
          const defaults = list.filter((t: any) => t.is_default).map((t: any) => t.id)
          if (defaults.length > 0) return defaults
        }
        return cleaned
      })
      // 自动选中新添加的出行人
      const pendingId = Taro.getStorageSync('order_confirm_select_traveler_id')
      if (pendingId) {
        Taro.removeStorageSync('order_confirm_select_traveler_id')
        const found = list.find((t: any) => String(t.id) === String(pendingId))
        if (found) {
          setSelectedTravelerIds(prev => prev.includes(found.id) ? prev : [...prev, found.id])
        }
      }
    } catch (err: any) {
      if (err?.statusCode === 401) {
        Taro.showModal({ title: '提示', content: '请先登录', showCancel: false, success: () => Taro.navigateTo({ url: '/pages/login/index' }) })
      }
      setTravelers([])
    }
  }

  const loadPets = async () => {
    try {
      const res = await getPets()
      const list = res.data || []
      setPets(list)
      // 若之前有选中但已被删除的 ID，自动清理；无选中时自动勾选默认宠物
      setSelectedPetIds(prev => {
        const cleaned = prev.filter(id => list.some((p: any) => p.id === id))
        if (cleaned.length === 0) {
          const defaults = list.filter((p: any) => p.is_default).map((p: any) => p.id)
          if (defaults.length > 0) return defaults
        }
        return cleaned
      })
      // 自动选中新添加的宠物
      const pendingId = Taro.getStorageSync('order_confirm_select_pet_id')
      if (pendingId) {
        Taro.removeStorageSync('order_confirm_select_pet_id')
        const found = list.find((p: any) => String(p.id) === String(pendingId))
        if (found) {
          setSelectedPetIds(prev => prev.includes(found.id) ? prev : [...prev, found.id])
        }
      }
    } catch (err: any) {
      if (err?.statusCode === 401) {
        Taro.showModal({ title: '提示', content: '请先登录', showCancel: false, success: () => Taro.navigateTo({ url: '/pages/login/index' }) })
      }
      setPets([])
    }
  }

  const togglePet = (id: number) => {
    setSelectedPetIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    )
  }

  const toggleTravelerInModal = (id: number) => {
    setSelectedTravelerIds(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    )
  }

  const togglePetInModal = (id: number) => {
    setSelectedPetIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    )
  }

  const goAddPet = () => {
    Taro.navigateTo({ url: '/pages/profile/pet-edit/index?from=order' })
  }

  const goEditPet = (id: number, e?: any) => {
    e && e.stopPropagation()
    Taro.navigateTo({ url: `/pages/profile/pet-edit/index?id=${id}&from=order` })
  }

  const goEditTraveler = (id: number) => {
    Taro.navigateTo({ url: `/pages/profile/traveler-edit/index?id=${id}&from=order` })
  }

  const handleRemoveTraveler = (id: number) => {
    setSelectedTravelerIds(prev => prev.filter(tid => tid !== id))
  }

  const handleRemovePet = (id: number, e?: any) => {
    e && e.stopPropagation()
    setSelectedPetIds(prev => prev.filter(pid => pid !== id))
  }

  // 行程选配数量调整
  const changeAddonQty = (addonId: number, delta: number, limit: number) => {
    setAddonQuantities(prev => {
      const current = prev[addonId] || 0
      const next = Math.max(0, Math.min(limit > 0 ? limit : 99, current + delta))
      if (next === 0) {
        const { [addonId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [addonId]: next }
    })
  }

  const setAddonQtyInput = (addonId: number, value: string, limit: number) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num <= 0) {
      setAddonQuantities(prev => {
        const { [addonId]: _, ...rest } = prev
        return rest
      })
      return
    }
    const next = Math.min(limit > 0 ? limit : 99, num)
    setAddonQuantities(prev => ({ ...prev, [addonId]: next }))
  }

  // 狗狗票选项数量调整
  const changeAddonOptionQty = (addonId: number, optionName: string, delta: number, limit: number) => {
    setAddonOptionQuantities(prev => {
      const addonOptions = prev[addonId] || {}
      const current = addonOptions[optionName] || 0
      const next = Math.max(0, Math.min(limit > 0 ? limit : 99, current + delta))
      const newAddonOptions = { ...addonOptions }
      if (next === 0) {
        delete newAddonOptions[optionName]
      } else {
        newAddonOptions[optionName] = next
      }
      if (Object.keys(newAddonOptions).length === 0) {
        const { [addonId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [addonId]: newAddonOptions }
    })
  }

  // 酒店房型数量调整
  const changeAddonRoomQty = (addonId: number, roomName: string, delta: number, limit: number) => {
    setAddonRoomQuantities(prev => {
      const addonRooms = prev[addonId] || {}
      const current = addonRooms[roomName] || 0
      const next = Math.max(0, Math.min(limit > 0 ? limit : 99, current + delta))
      const newAddonRooms = { ...addonRooms }
      if (next === 0) {
        delete newAddonRooms[roomName]
      } else {
        newAddonRooms[roomName] = next
      }
      if (Object.keys(newAddonRooms).length === 0) {
        const { [addonId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [addonId]: newAddonRooms }
    })
  }

  const handleSubmit = async () => {
    console.log('submit clicked', { selectedTravelers: selectedTravelers.length, selectedPetIds: selectedPetIds.length, hasRoute: !!route, hasSchedule: !!schedule })
    if (selectedTravelers.length === 0) {
      Taro.showToast({ title: '请至少选择1位出行人', icon: 'none' })
      return
    }
    // 免费路线只需要1人1宠（不显示增加人宠模块）
    if (route?.is_free) {
      if (selectedTravelers.length < 1) {
        Taro.showToast({ title: '请至少选择1位出行人', icon: 'none' })
        return
      }
      if (selectedPetIds.length < 1) {
        Taro.showToast({ title: '请至少选择1只宠物', icon: 'none' })
        return
      }
    } else {
      // 单人轻旅（无宠）不需要宠物
      if (bookingParams?.packageType !== 'single_person' && selectedPetIds.length === 0) {
        Taro.showToast({ title: '请至少选择1只宠物', icon: 'none' })
        return
      }
      // 校验人数是否满足套餐基础数 + BookingPopup 中的额外选择数
      const requiredPersons = pkgConfig.basePerson + (bookingParams?.extraPerson || 0)
      const requiredPets = pkgConfig.basePet + (bookingParams?.extraPet || 0)
      if (selectedTravelers.length < requiredPersons) {
        Taro.showToast({ title: `您选择了增加${bookingParams?.extraPerson || 0}人，请至少添加${requiredPersons}位出行人`, icon: 'none' })
        return
      }
      if (bookingParams?.packageType !== 'single_person' && selectedPetIds.length < requiredPets) {
        Taro.showToast({ title: `您选择了增加${bookingParams?.extraPet || 0}宠，请至少添加${requiredPets}只宠物`, icon: 'none' })
        return
      }
    }
    if (!schedule || !route) {
      Taro.showToast({ title: '路线或排期信息加载失败', icon: 'none' })
      return
    }
    if (agreements.length > 0 && !agreed) {
      Taro.showToast({ title: '请先阅读并同意相关协议', icon: 'none' })
      return
    }
    try {
      const contact = selectedTravelers[0]
      const participants = selectedTravelers.slice(1)
      const selectedAddons = addons
        .filter((a: any) => {
          if (a.category === 'dog_ticket' && a.extra_config?.options?.length > 0) {
            const optionQtyMap = addonOptionQuantities[a.id] || {}
            return Object.values(optionQtyMap).some((q: number) => q > 0)
          }
          if (a.category === 'hotel' && a.extra_config?.rooms?.length > 0) {
            const roomQtyMap = addonRoomQuantities[a.id] || {}
            return Object.values(roomQtyMap).some((q: number) => q > 0)
          }
          return (addonQuantities[a.id] || 0) > 0
        })
        .map((a: any) => {
          if (a.category === 'dog_ticket' && a.extra_config?.options?.length > 0) {
            const optionQtyMap = addonOptionQuantities[a.id] || {}
            const selectedOptions = a.extra_config.options
              .filter((opt: any) => (optionQtyMap[opt.name] || 0) > 0)
              .map((opt: any) => ({
                name: opt.name,
                price: opt.price,
                quantity: optionQtyMap[opt.name],
                description: opt.description
              }))
            return {
              addon_id: a.id,
              category: a.category,
              name: a.name,
              price: 0,
              quantity: 1,
              unit: a.unit,
              selected_options: selectedOptions
            }
          }
          if (a.category === 'hotel' && a.extra_config?.rooms?.length > 0) {
            const roomQtyMap = addonRoomQuantities[a.id] || {}
            const selectedRooms = a.extra_config.rooms
              .filter((room: any) => (roomQtyMap[room.name] || 0) > 0)
              .map((room: any) => ({
                name: room.name,
                price: room.price,
                quantity: roomQtyMap[room.name],
                images: room.images || [],
                area: room.area,
                bed_type: room.bed_type,
              }))
            return {
              addon_id: a.id,
              category: a.category,
              name: a.name,
              price: 0,
              quantity: 1,
              unit: a.unit,
              selected_rooms: selectedRooms
            }
          }
          return {
            addon_id: a.id,
            category: a.category,
            name: a.name,
            price: a.price,
            quantity: addonQuantities[a.id],
            unit: a.unit
          }
        })
      const res: any = await createOrder({
        route_id: route.id,
        schedule_id: schedule.id,
        route_name: route.name,
        travel_date: schedule.schedule_date,
        contact: { name: contact.name, phone: contact.phone },
        participants,
        pets: selectedPets.map(p => ({ id: p.id, name: p.name, breed: p.breed, weight: p.weight, gender: p.gender })),
        participant_count: selectedTravelers.length,
        pet_count: selectedPetIds.length,
        route_price: route?.is_free ? 0 : routePrice,
        insurance_price: route?.is_free ? 0 : petInsuranceTotal + personInsuranceTotal,
        equipment_price: 0,
        discount_amount: route?.is_free ? 0 : couponDiscount,
        coupon_id: route?.is_free ? null : selectedCouponId,
        addons: route?.is_free ? [] : [...(bookingParams?.addons || []), ...selectedAddons],
        addon_amount: route?.is_free ? 0 : addonTotal,
        travel_type: route?.is_free ? 'bus' : bookingParams?.travelType,
        is_free: route?.is_free ? 1 : 0
      })
      if (res.code !== 200) {
        throw new Error(res.message || '创建订单失败')
      }
      if (res.data?.order_id) {
        // 免费路线直接跳转订单详情（无需支付）
        if (route?.is_free || res.data.pay_amount === 0) {
          Taro.redirectTo({ url: `/pages/orders/detail/index?id=${res.data.order_id}` })
        } else {
          Taro.navigateTo({ url: `/pages/orders/pay/index?id=${res.data.order_id}` })
        }
      } else {
        Taro.showToast({ title: '订单创建异常，请重试', icon: 'none' })
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '提交失败', icon: 'none' })
    }
  }

  const selectedTravelers = travelers.filter(t => selectedTravelerIds.includes(t.id))
  const selectedPets = pets.filter(p => selectedPetIds.includes(p.id))
  const travelType = bookingParams?.travelType || 'bus'

  // 套餐配置
  const pkgType = bookingParams?.packageType || 'couple'
  const pkgConfig = PACKAGE_OPTIONS.find(p => p.key === pkgType) || PACKAGE_OPTIONS[0]

  // 价格完全从排期取（不再回退到路线默认价）
  const priceField = travelType === 'self_drive' ? `self_drive_${pkgConfig.priceField}` : pkgConfig.priceField
  const schedulePriceField = pkgConfig.priceField === 'base_price'
    ? (travelType === 'self_drive' ? 'self_drive_price' : 'price')
    : priceField
  let basePrice = schedule && schedule[schedulePriceField] != null ? schedule[schedulePriceField] : 0

  // 额外单价：完全从排期取
  const extraPersonScheduleField = travelType === 'self_drive' ? 'self_drive_extra_person_price' : 'extra_person_price'
  const extraPersonUnitPrice = schedule && schedule[extraPersonScheduleField] != null
    ? schedule[extraPersonScheduleField] : 0

  const extraPetScheduleField = travelType === 'self_drive' ? 'self_drive_extra_pet_price' : 'extra_pet_price'
  const extraPetUnitPrice = schedule && schedule[extraPetScheduleField] != null
    ? schedule[extraPetScheduleField] : 0

  // 额外数量：取 BookingPopup 中的选择与实际差额的最大值
  // BookingPopup 中的 extraPerson/extraPet 是用户意向（保底），实际带更多人则追加
  const actualExtraPerson = Math.max(0, selectedTravelers.length - pkgConfig.basePerson)
  const actualExtraPet = Math.max(0, selectedPetIds.length - pkgConfig.basePet)
  const extraPersonCount = Math.max(bookingParams?.extraPerson || 0, actualExtraPerson)
  const extraPetCount = Math.max(bookingParams?.extraPet || 0, actualExtraPet)

  // 路线价格（基础价 + 加人 + 加宠，不含保险）
  const routePrice = basePrice + extraPersonCount * extraPersonUnitPrice + extraPetCount * extraPetUnitPrice

  // 保险（按实际选中的出行人/宠物计算）
  const petInsuranceTotal = 15 * selectedPetIds.length
  const personInsuranceTotal = 10 * selectedTravelers.length

  // 行程选配合计（从 bookingParams.addons）
  const addonTotal = (bookingParams?.addons || []).reduce((sum: number, a: any) => sum + (a.price || 0) * (a.quantity || 1), 0)

  // 总计
  const total = routePrice + addonTotal + petInsuranceTotal + personInsuranceTotal
  // 免费路线只需1人1宠，付费路线按原逻辑
  const canSubmit = selectedTravelers.length > 0
    && (route?.is_free ? selectedPetIds.length > 0 : selectedPetIds.length > 0)
    && (agreements.length === 0 || agreed)

  // 加载可用优惠券
  const selectedCouponIdRef = useRef(selectedCouponId)
  selectedCouponIdRef.current = selectedCouponId

  useEffect(() => {
    if (!route?.id) return
    const loadCoupons = async () => {
      try {
        const res = await getAvailableCoupons({ route_id: route.id, amount: total })
        if (res.code === 200) {
          const available = res.data?.available || []
          setAvailableCoupons(available)

          // 检查当前选中的券是否仍然可用，若不可用则取消选中
          const currentId = selectedCouponIdRef.current
          if (currentId) {
            const stillAvailable = available.some((c: any) => c.id === currentId)
            if (!stillAvailable) {
              setSelectedCouponId(null)
              setCouponDiscount(0)
            }
          } else if (res.data?.best_coupon_id) {
            // 未选中时自动选中最优券
            setSelectedCouponId(res.data.best_coupon_id)
            const best = available.find((c: any) => c.id === res.data.best_coupon_id)
            if (best) setCouponDiscount(best.discount_amount)
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadCoupons()
  }, [route?.id, total, selectedTravelers.length, selectedPetIds.length])

  // 选择优惠券时重新计算优惠
  const handleSelectCoupon = (couponId: number | null) => {
    setSelectedCouponId(couponId)
    if (!couponId) {
      setCouponDiscount(0)
      setShowCouponModal(false)
      return
    }
    const coupon = availableCoupons.find((c: any) => c.id === couponId)
    if (coupon) {
      setCouponDiscount(coupon.discount_amount)
    }
    setShowCouponModal(false)
  }

  const finalTotal = Math.max(0, Math.round((total - couponDiscount) * 100) / 100)

  const pkgLabelMap: any = { couple: '一人一宠', single_person: '单人轻旅（无宠）', two_person_one_pet: '二人一宠', one_person_two_pet: '一人两宠', single_pet: '毛孩专属接送（无主人陪同）' }

  return (
    <View className='order-confirm'>
      {/* 顶部导航栏 */}
      <View className='top-nav'>
        <Text className='nav-back' onClick={() => {
          const pages = Taro.getCurrentPages()
          if (pages.length <= 1) {
            Taro.switchTab({ url: '/pages/index/index' })
          } else {
            Taro.navigateBack({ delta: 1 })
          }
        }}>{'<'}</Text>
        <Text className='nav-title'>提交订单</Text>
      </View>

      <View className='main-content'>
        {/* Hero 行程摘要 */}
        <View className='hero-section'>
          <Image className='hero-image' src={compressImageUrl(route?.cover_image, 750) || 'https://via.placeholder.com/750x420'} mode='aspectFill' />
          <View className='hero-overlay'>
            <View className='hero-tags'>
              <Text className='hero-tag'>{route?.duration || '1天'}游</Text>
            </View>
            <Text className='hero-title'>{route?.name || '路线名称'}</Text>
            <View className='hero-date'>
              <Text>📅</Text>
              <Text>{schedule?.schedule_date || '-'} 出发</Text>
            </View>
            {!route?.is_free && (
              <View className='hero-chips'>
                <Text className='hero-chip'>{pkgLabelMap[bookingParams?.packageType] || '一人一宠'}</Text>
                <Text className='hero-chip'>{bookingParams?.travelType === 'bus' ? '大巴出行' : '自行前往'}</Text>
              </View>
            )}
          </View>
        </View>

      {/* 出行人信息 */}
      <View className='section-block'>
        <View className='section-header'>
          <View className='section-title'>
            <Text className='section-icon'>👤</Text>
            <Text>出行人信息</Text>
          </View>
          <View className='section-actions'>
            <Text className='section-action' onClick={() => setShowTravelerModal(true)}>从档案选择</Text>
            <Text className='section-action' onClick={() => Taro.navigateTo({ url: '/pages/profile/traveler-edit/index?from=order' })}>+ 新增</Text>
          </View>
        </View>
        {selectedTravelers.length === 0 ? (
          <View className='empty-state'>
            <Text className='empty-icon'>👤</Text>
            <Text className='empty-text'>尚未选择出行人</Text>
          </View>
        ) : (
          selectedTravelers.map((t) => (
            <View key={t.id} className='info-card'>
              <View className='info-left'>
                <View className='info-name-row'>
                  <Text className='info-name'>{t.name}</Text>
                  {t.is_default ? <Text className='default-badge'>默认</Text> : null}
                </View>
                <Text className='info-detail'>电话：{maskPhone(t.phone)}</Text>
                <Text className='info-detail'>身份证：{maskIdCard(t.id_card)}</Text>
              </View>
              <View className='info-right'>
                <Text className='info-action' onClick={() => goEditTraveler(t.id)}>✎ 编辑</Text>
                <Text className='info-action delete' onClick={() => handleRemoveTraveler(t.id)}>✕ 移除</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 宠物信息 */}
      <View className='section-block'>
        <View className='section-header'>
          <View className='section-title'>
            <Text className='section-icon'>🐾</Text>
            <Text>宠物信息</Text>
          </View>
          <View className='section-actions'>
            <Text className='section-action' onClick={() => setShowPetModal(true)}>从档案选择</Text>
            <Text className='section-action' onClick={goAddPet}>+ 新增</Text>
          </View>
        </View>
        {selectedPets.length === 0 ? (
          <View className='empty-state'>
            <Text className='empty-icon'>🐾</Text>
            <Text className='empty-text'>尚未选择宠物</Text>
          </View>
        ) : (
          selectedPets.map(pet => (
            <View key={pet.id} className='info-card'>
              <View className='pet-avatar-wrap'>
                <Image className='pet-avatar' src={compressImageUrl(pet.avatar, 200) || 'https://via.placeholder.com/120'} mode='aspectFill' />
                <View className='info-left'>
                  <View className='info-name-row'>
                    <Text className='info-name'>{pet.name}</Text>
                    <Text className='pet-gender'>{GENDER_MAP[pet.gender] || '-'}</Text>
                  </View>
                  <Text className='info-detail'>
                    {formatAge(pet.age_str) || (calcAge(pet.birth_date) !== '-' ? calcAge(pet.birth_date) + '岁' : '-')} | {pet.weight || '-'}kg | {pet.breed || '-'}
                  </Text>
                </View>
              </View>
              <View className='info-right'>
                <Text className='info-action' onClick={(e) => goEditPet(pet.id, e)}>✎ 编辑</Text>
                <Text className='info-action delete' onClick={(e) => handleRemovePet(pet.id, e)}>✕ 移除</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 已选信息（从弹窗传入）—— 免费路线隐藏 */}
      {!route?.is_free && bookingParams && (
        <View className='section-block'>
          <Text className='section-label'>【已选信息】</Text>
          <View className='selected-info'>
            <View className='info-row'>
              <Text className='info-label'>套餐类型</Text>
              <Text className='info-value'>
                {{ couple: '一人一宠', single_person: '单人轻旅（无宠）', two_person_one_pet: '二人一宠', one_person_two_pet: '一人两宠', single_pet: '毛孩专属接送（无主人陪同）' }[bookingParams.packageType] || '一人一宠'}
              </Text>
            </View>
            <View className='info-row'>
              <Text className='info-label'>交通方式</Text>
              <Text className='info-value'>
                {bookingParams.travelType === 'bus' ? '大巴出行' : '自行前往'}
              </Text>
            </View>
            {(extraPersonCount > 0 || extraPetCount > 0) && (
              <View className='info-row'>
                <Text className='info-label'>额外增加</Text>
                <Text className='info-value'>
                  {extraPersonCount > 0 ? `成人+${extraPersonCount} ` : ''}
                  {extraPetCount > 0 ? `宠物+${extraPetCount}` : ''}
                </Text>
              </View>
            )}
            {bookingParams.addons?.length > 0 && (
              <View className='info-row'>
                <Text className='info-label'>行程选配</Text>
                <View className='info-value-column'>
                  {bookingParams.addons.map((a: any) => (
                    <Text key={a.id} className='info-addon'>{a.name} x{a.quantity || 1}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 保险服务 —— 免费路线隐藏 */}
      {!route?.is_free && (
        <View className='insurance-section'>
        <View className='insurance-header'>
          <Text className='insurance-icon'>🛡</Text>
          <Text className='insurance-title'>保险服务</Text>
          <Text className='insurance-badge'>必选</Text>
        </View>
        <View className={`insurance-item ${selectedPetIds.length > 0 ? 'active' : 'disabled'}`}>
          {selectedPetIds.length > 0 && <View className='insurance-check'>✓</View>}
          <View className='insurance-left'>
            <View className='insurance-name-row'>
              <Text className='insurance-name'>宠物意外险</Text>
              <Text className='insurance-price'>+¥15/狗</Text>
            </View>
            <Text className='insurance-desc'>保障宠物行程中突发意外医疗费用，最高保额¥5000</Text>
          </View>
          <Text className='insurance-total'>¥{petInsuranceTotal}</Text>
        </View>
        <View className={`insurance-item ${selectedTravelers.length > 0 ? 'active' : 'disabled'}`}>
          {selectedTravelers.length > 0 && <View className='insurance-check'>✓</View>}
          <View className='insurance-left'>
            <View className='insurance-name-row'>
              <Text className='insurance-name'>人身意外险</Text>
              <Text className='insurance-price'>+¥10/人</Text>
            </View>
            <Text className='insurance-desc'>保障出行人意外伤害及医疗，最高保额¥200,000</Text>
          </View>
          <Text className='insurance-total'>¥{personInsuranceTotal}</Text>
        </View>
        <Text className='insurance-tip'>注：按出行人与宠物数量自动计算，不可取消。</Text>
      </View>
      )}

      {/* 优惠券 —— 免费路线隐藏 */}
      {!route?.is_free && (
      <View className='section-block'>
        <View className='coupon-row' onClick={() => setShowCouponModal(true)}>
          <View className='coupon-left'>
            <Text className='coupon-icon'>🎫</Text>
            <Text className='coupon-title'>优惠券</Text>
          </View>
          <View className='coupon-right'>
            {selectedCouponId && couponDiscount > 0 ? (
              <Text className='coupon-text' style={{ color: '#ba1a1a' }}>-¥{couponDiscount}</Text>
            ) : (
              <Text className='coupon-text'>
                {availableCoupons.length > 0 ? `${availableCoupons.length}张可用` : '暂无可用优惠券'}
              </Text>
            )}
            <Text className='coupon-arrow'>›</Text>
          </View>
        </View>
      </View>
      )}

      {/* 协议声明 */}
      {agreements.length > 0 && (
        <View className='agreement-section'>
          <View className='agreement-check-wrap' onClick={() => setAgreed(!agreed)}>
            <View className={`agreement-check-input ${agreed ? 'checked' : ''}`}>
              {agreed && <Text className='agreement-check-icon'>✓</Text>}
            </View>
          </View>
          <Text className='agreement-text'>
            已阅读并同意
            {agreements.map((a: any, idx: number) => (
              <Text key={a.id}>
                <Text
                  className='agreement-link'
                  onClick={(e) => {
                    e.stopPropagation()
                    Taro.navigateTo({ url: `/pages/agreements/detail/index?id=${a.id}` })
                  }}
                >
                  {a.title}
                </Text>
                {idx < agreements.length - 1 && '、'}
              </Text>
            ))}
          </Text>
        </View>
      )}

      </View>

      {/* 底部固定栏 */}
      <View className='bottom-bar'>
        <View className='bottom-content'>
          <View className='bottom-left'>
            {!route?.is_free && (
              <View className='detail-btn' onClick={() => setShowPriceDetail(true)}>
                <Text className='detail-icon'>📋</Text>
                <Text className='detail-label'>明细</Text>
              </View>
            )}
            <View className='price-wrap'>
              <Text className='price-label'>{route?.is_free ? '费用' : '合计'}</Text>
              <Text className='price-value'>{route?.is_free ? '免费' : `¥${finalTotal}`}</Text>
            </View>
          </View>
          <View className={`submit-btn ${canSubmit ? '' : 'disabled'}`} onClick={handleSubmit}>
            {route?.is_free ? '确认报名' : '提交订单'}
          </View>
        </View>
      </View>

      {/* 价格明细弹窗 */}
      {showPriceDetail && (
        <View className='traveler-modal-wrap' onClick={() => setShowPriceDetail(false)}>
          <View className='modal-mask' />
          <View className='price-detail-modal' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='modal-title'>价格明细</Text>
              <Text className='modal-close' onClick={() => setShowPriceDetail(false)}>✕</Text>
            </View>
            <View className='price-detail-body'>
              {/* 基础价 */}
              <View className='price-detail-row'>
                <Text className='price-detail-name'>基础价（{pkgConfig.label}）</Text>
                <Text className='price-detail-value'>¥{basePrice}</Text>
              </View>
              {extraPersonCount > 0 && (
                <View className='price-detail-row sub'>
                  <Text className='price-detail-name'>　增加{extraPersonCount}成人</Text>
                  <Text className='price-detail-value'>¥{extraPersonCount * extraPersonUnitPrice}</Text>
                </View>
              )}
              {extraPetCount > 0 && (
                <View className='price-detail-row sub'>
                  <Text className='price-detail-name'>　增加{extraPetCount}宠物</Text>
                  <Text className='price-detail-value'>¥{extraPetCount * extraPetUnitPrice}</Text>
                </View>
              )}
              {/* 选配 */}
              {addonTotal > 0 && (
                <>
                  {(bookingParams?.addons || []).map((a: any) => (
                    <View key={a.id || a.name} className='price-detail-row sub'>
                      <Text className='price-detail-name'>　{a.name} x{a.quantity || 1}</Text>
                      <Text className='price-detail-value'>¥{(a.price || 0) * (a.quantity || 1)}</Text>
                    </View>
                  ))}
                </>
              )}
              {/* 保险 */}
              {petInsuranceTotal > 0 && (
                <View className='price-detail-row'>
                  <Text className='price-detail-name'>宠物意外险（{selectedPetIds.length}份）</Text>
                  <Text className='price-detail-value'>¥{petInsuranceTotal}</Text>
                </View>
              )}
              {personInsuranceTotal > 0 && (
                <View className='price-detail-row'>
                  <Text className='price-detail-name'>人身意外险（{selectedTravelers.length}份）</Text>
                  <Text className='price-detail-value'>¥{personInsuranceTotal}</Text>
                </View>
              )}
              {/* 优惠券 */}
              {couponDiscount > 0 && (
                <View className='price-detail-row discount'>
                  <Text className='price-detail-name'>优惠券</Text>
                  <Text className='price-detail-value'>-¥{couponDiscount}</Text>
                </View>
              )}
              {/* 分割线 */}
              <View className='price-detail-divider' />
              {/* 合计 */}
              <View className='price-detail-row total'>
                <Text className='price-detail-name'>合计</Text>
                <Text className='price-detail-value'>¥{finalTotal}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 出行人选择弹窗 */}
      {showTravelerModal && (
        <View className='traveler-modal-wrap'>
          <View className='modal-mask' onClick={() => setShowTravelerModal(false)} />
          <View className='traveler-modal'>
            <View className='modal-header'>
              <Text className='modal-title'>选择出行人</Text>
              <Text className='modal-close' onClick={() => setShowTravelerModal(false)}>✕</Text>
            </View>
            <View className='modal-body'>
              {travelers.map(t => {
                const checked = selectedTravelerIds.includes(t.id)
                return (
                  <View key={t.id} className='modal-item' onClick={() => toggleTravelerInModal(t.id)}>
                    <View className='modal-item-info'>
                      <Text className='modal-item-name'>{t.name} <Text className='modal-item-phone'>{maskPhone(t.phone)}</Text></Text>
                      <Text className='modal-item-sub'>身份证：{maskIdCard(t.id_card)}</Text>
                    </View>
                    <View className={`check-circle ${checked ? 'checked' : ''}`} />
                  </View>
                )
              })}
              {travelers.length === 0 && (
                <View className='modal-empty'>
                  <Text className='empty-tip'>暂无出行人档案，请先添加</Text>
                </View>
              )}
            </View>
            <View className='modal-footer'>
              <View className='modal-confirm' onClick={() => setShowTravelerModal(false)}>确定</View>
            </View>
          </View>
        </View>
      )}

      {/* 酒店房型详情弹窗 */}
      <HotelRoomModal room={selectedRoom} visible={!!selectedRoom} onClose={() => setSelectedRoom(null)} />

      {/* 优惠券选择弹窗 */}
      {showCouponModal && (
        <View className='traveler-modal-wrap'>
          <View className='modal-mask' onClick={() => setShowCouponModal(false)} />
          <View className='traveler-modal'>
            <View className='modal-header'>
              <Text className='modal-title'>选择优惠券</Text>
              <Text className='modal-close' onClick={() => setShowCouponModal(false)}>✕</Text>
            </View>
            <View className='modal-body'>
              <View className='modal-item' onClick={() => handleSelectCoupon(null)}>
                <View className='modal-item-info'>
                  <Text className='modal-item-name'>不使用优惠券</Text>
                </View>
                {!selectedCouponId && <View className='check-circle checked' />}
              </View>
              {availableCoupons.map((c: any) => (
                <View key={c.id} className='modal-item' onClick={() => handleSelectCoupon(c.id)}>
                  <View className='modal-item-info'>
                    <Text className='modal-item-name'>{c.name}</Text>
                    <Text className='modal-item-sub'>
                      优惠¥{c.discount_amount} · {c.min_amount > 0 ? `满${c.min_amount}可用` : '无门槛'}
                    </Text>
                  </View>
                  {selectedCouponId === c.id && <View className='check-circle checked' />}
                </View>
              ))}
              {availableCoupons.length === 0 && (
                <View className='modal-empty'>
                  <Text className='empty-tip'>暂无可用优惠券</Text>
                </View>
              )}
            </View>
            <View className='modal-footer'>
              <View className='modal-confirm' onClick={() => setShowCouponModal(false)}>确定</View>
            </View>
          </View>
        </View>
      )}

      {/* 宠物选择弹窗 */}
      {showPetModal && (
        <View className='traveler-modal-wrap'>
          <View className='modal-mask' onClick={() => setShowPetModal(false)} />
          <View className='traveler-modal'>
            <View className='modal-header'>
              <Text className='modal-title'>选择宠物</Text>
              <Text className='modal-close' onClick={() => setShowPetModal(false)}>✕</Text>
            </View>
            <View className='modal-body'>
              {pets.map(p => {
                const checked = selectedPetIds.includes(p.id)
                return (
                  <View key={p.id} className='modal-item' onClick={() => togglePetInModal(p.id)}>
                    <View className='modal-item-info'>
                      <Text className='modal-item-name'>{p.name} <Text className='modal-item-phone'>{formatAge(p.age_str) || (calcAge(p.birth_date) !== '-' ? calcAge(p.birth_date) + '岁' : '-')} · {GENDER_MAP[p.gender] || '-'}</Text></Text>
                      <Text className='modal-item-sub'>{p.breed || '-'} · 体重：{p.weight || '-'}kg</Text>
                    </View>
                    <View className={`check-circle ${checked ? 'checked' : ''}`} />
                  </View>
                )
              })}
              {pets.length === 0 && (
                <View className='modal-empty'>
                  <Text className='empty-tip'>暂无宠物档案，请先添加</Text>
                </View>
              )}
            </View>
            <View className='modal-footer'>
              <View className='modal-confirm' onClick={() => setShowPetModal(false)}>确定</View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components'
import { getRouteDetail, getRouteSchedules, getPets, getTravelers, createOrder, getRouteAddons, getAvailableCoupons, calculateCoupon } from '../../../utils/api'
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

function maskPhone(phone?: string) {
  if (!phone || phone.length < 7) return phone || '-'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

function maskIdCard(idCard?: string) {
  if (!idCard || idCard.length < 8) return idCard || '-'
  return idCard.slice(0, 3) + '***********' + idCard.slice(-4)
}

/* ---------- 酒店房型详情弹窗 ---------- */
function HotelRoomModal({ room, visible, onClose }: any) {
  if (!visible || !room) return null
  const images = room.images?.length > 0 ? room.images : ['https://via.placeholder.com/750x420']
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
  const ADDON_TABS = [
    { key: 'dog_ticket', label: '狗狗票' },
    { key: 'hotel', label: '酒店' },
    { key: 'amusement', label: '游乐项目' }
  ]
  const [addons, setAddons] = useState<any[]>([])
  const [activeAddonTab, setActiveAddonTab] = useState('dog_ticket')
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

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const routeId = instance.router?.params?.routeId
    const scheduleId = instance.router?.params?.scheduleId
    if (routeId) {
      loadRouteData(Number(routeId), Number(scheduleId))
    }
  }, [])

  useDidShow(() => {
    loadTravelers()
    loadPets()
  })

  const loadRouteData = async (routeId: number, scheduleId: number) => {
    try {
      const rres = await getRouteDetail(routeId)
      setRoute(rres.data || {})
      const sres = await getRouteSchedules(routeId)
      const schedules = sres.data?.schedules || []
      const found = schedules.find((s: any) => String(s.id) === String(scheduleId))
      setSchedule(found || null)
      // 加载行程选配
      const ares = await getRouteAddons(routeId)
      const addonList = ares.data?.addons || []
      setAddons(addonList)
      // 必选项默认数量为1
      const defaultQty: Record<number, number> = {}
      const defaultOptionQty: Record<number, Record<string, number>> = {}
      const defaultRoomQty: Record<number, Record<string, number>> = {}
      addonList.forEach((a: any) => {
        if (a.is_required) {
          if (a.category === 'dog_ticket' && a.extra_config?.options?.length > 0) {
            // 有选项的狗狗票，默认不选任何选项（让用户自己选择）
          } else if (a.category === 'hotel' && a.extra_config?.rooms?.length > 0) {
            // 有房型的酒店，默认不选任何房型（让用户自己选择）
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
    if (selectedPetIds.length === 0) {
      Taro.showToast({ title: '请至少选择1只宠物', icon: 'none' })
      return
    }
    if (!schedule || !route) {
      Taro.showToast({ title: '路线或排期信息加载失败', icon: 'none' })
      return
    }
    try {
      const contact = selectedTravelers[0]
      const participants = selectedTravelers.slice(1)
      const insurancePrice = 15 * selectedPetIds.length + 10 * selectedTravelers.length
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
        route_price: schedule.price || route.base_price || 0,
        insurance_price: insurancePrice,
        equipment_price: 0,
        discount_amount: couponDiscount,
        coupon_id: selectedCouponId,
        addons: selectedAddons,
        addon_amount: addonTotal
      })
      if (res.code !== 200) {
        throw new Error(res.message || '创建订单失败')
      }
      if (res.data?.order_id) {
        Taro.navigateTo({ url: `/pages/orders/pay/index?id=${res.data.order_id}` })
      } else {
        Taro.showToast({ title: '订单创建异常，请重试', icon: 'none' })
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '提交失败', icon: 'none' })
    }
  }

  const selectedTravelers = travelers.filter(t => selectedTravelerIds.includes(t.id))
  const selectedPets = pets.filter(p => selectedPetIds.includes(p.id))
  const unitPrice = schedule?.price || route?.base_price || 0
  const extraPersonPrice = route?.extra_person_price || 0
  const extraPetPrice = route?.extra_pet_price || 0
  const petInsuranceTotal = 15 * selectedPetIds.length
  const personInsuranceTotal = 10 * selectedTravelers.length
  // 行程选配合计
  const addonTotal = addons.reduce((sum, a) => {
    // 有选项的狗狗票，累加选项价格
    if (a.category === 'dog_ticket' && a.extra_config?.options?.length > 0) {
      const optionQtyMap = addonOptionQuantities[a.id] || {}
      const optionSum = a.extra_config.options.reduce((optSum: number, opt: any) => {
        const qty = optionQtyMap[opt.name] || 0
        return optSum + opt.price * qty
      }, 0)
      return sum + optionSum
    }
    // 有房型酒店，累加房型价格
    if (a.category === 'hotel' && a.extra_config?.rooms?.length > 0) {
      const roomQtyMap = addonRoomQuantities[a.id] || {}
      const roomSum = a.extra_config.rooms.reduce((rSum: number, room: any) => {
        const qty = roomQtyMap[room.name] || 0
        return rSum + room.price * qty
      }, 0)
      return sum + roomSum
    }
    const qty = addonQuantities[a.id] || 0
    return sum + a.price * qty
  }, 0)
  // 新价格逻辑：基础价(1人1宠) + 加人 + 加宠；未配置增量时回退到老逻辑
  const useNewPricing = extraPersonPrice > 0 || extraPetPrice > 0
  const routePrice = useNewPricing
    ? unitPrice + Math.max(0, selectedTravelers.length - 1) * extraPersonPrice + Math.max(0, selectedPetIds.length - 1) * extraPetPrice
    : unitPrice * selectedTravelers.length
  const total = routePrice + petInsuranceTotal + personInsuranceTotal + addonTotal
  const canSubmit = selectedTravelers.length > 0 && selectedPetIds.length > 0

  // 加载可用优惠券
  useEffect(() => {
    if (!route?.id || total <= 0) return
    const loadCoupons = async () => {
      try {
        const res = await getAvailableCoupons({ route_id: route.id, amount: total })
        if (res.code === 200) {
          setAvailableCoupons(res.data?.available || [])
          // 如果有最优券且未手动选择，自动选中
          if (res.data?.best_coupon_id && !selectedCouponId) {
            setSelectedCouponId(res.data.best_coupon_id)
            const best = res.data.available?.find((c: any) => c.id === res.data.best_coupon_id)
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

  const finalTotal = selectedTravelers.length === 0
    ? unitPrice
    : Math.max(0, Math.round((total - couponDiscount) * 100) / 100)

  return (
    <View className='order-confirm' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      {/* 橙色头部栏 */}
      <View className='order-header'>
        <Text className='header-title'>{route?.name || '路线名称'}</Text>
        <Text className='header-sub'>
          {schedule?.schedule_date || '-'} 出发 | {route?.duration || '1天'}
        </Text>
      </View>

      {/* 出行人信息 */}
      <View className='section-block'>
        <View className='section-header'>
          <Text className='section-label'>【出行人信息】</Text>
          <View className='section-header-actions'>
            <Text className='section-header-action' onClick={() => setShowTravelerModal(true)}>从档案选择</Text>
            <Text className='section-header-action primary' onClick={() => Taro.navigateTo({ url: '/pages/profile/traveler-edit/index?from=order' })}>+ 新增出行人</Text>
          </View>
        </View>
        {selectedTravelers.map((t, idx) => (
          <View key={t.id} className='info-card traveler-card'>
            <View className='info-main'>
              <Text className='info-name'>
                {t.name}
                {t.is_default ? <Text className='default-tag'>默认</Text> : null}
                {idx === 0 ? '（默认联系人）' : '（同行人）'}
              </Text>
              <Text className='info-detail'>{maskPhone(t.phone)} | 身份证:{maskIdCard(t.id_card)}</Text>
            </View>
            <View className='card-actions'>
              <Text className='action-text' onClick={() => goEditTraveler(t.id)}>编辑</Text>
              <Text className='action-text delete' onClick={() => handleRemoveTraveler(t.id)}>移除</Text>
            </View>
          </View>
        ))}
        {selectedTravelers.length === 0 && <Text className='empty-tip'>尚未选择出行人</Text>}
      </View>

      {/* 宠物信息 */}
      <View className='section-block'>
        <View className='section-header'>
          <Text className='section-label'>【宠物信息】</Text>
          <View className='section-header-actions'>
            <Text className='section-header-action' onClick={() => setShowPetModal(true)}>从档案选择</Text>
            <Text className='section-header-action primary' onClick={goAddPet}>+ 新增宠物</Text>
          </View>
        </View>
        {selectedPets.map(pet => (
          <View key={pet.id} className='info-card pet-card active' onClick={() => togglePet(pet.id)}>
            <Image className='pet-avatar-small' src={pet.avatar || 'https://via.placeholder.com/120'} mode='aspectFill' />
            <View className='info-main'>
              <Text className='info-name'>
                {pet.name}
                {pet.is_default ? <Text className='default-tag'>默认</Text> : null}
                （{calcAge(pet.birth_date)}岁，{GENDER_MAP[pet.gender] || '-'}）
              </Text>
              <Text className='info-detail'>{pet.breed || '-'} · 体重:{pet.weight || '-'}kg</Text>
            </View>
            <View className='card-right'>
              <View className='check-circle checked' />
              <View className='card-actions-inline'>
                <Text className='action-text' onClick={(e) => goEditPet(pet.id, e)}>编辑</Text>
                <Text className='action-text delete' onClick={(e) => handleRemovePet(pet.id, e)}>移除</Text>
              </View>
            </View>
          </View>
        ))}
        {selectedPets.length === 0 && <Text className='empty-tip'>尚未选择宠物</Text>}
      </View>

      {/* 行程选配 */}
      {addons.length > 0 && (
        <View className='section-block'>
          <Text className='section-label'>【行程选配】</Text>
          <View className='addon-tabs'>
            {ADDON_TABS.map(tab => (
              <View
                key={tab.key}
                className={`addon-tab ${activeAddonTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveAddonTab(tab.key)}
              >
                <Text>{tab.label}</Text>
              </View>
            ))}
          </View>
          <View className='addon-list'>
            {(() => { const list = addons.filter((a: any) => a.category === activeAddonTab); if (list.length === 0) return <Text className='empty-tip'>该分类暂无选配项目</Text>; return list.map((addon: any) => {
              const limit = addon.limit_per_order || 99
              // 狗狗票且有选项规格
              if (addon.category === 'dog_ticket' && addon.extra_config?.options?.length > 0) {
                const optionQtyMap = addonOptionQuantities[addon.id] || {}
                return (
                  <View key={addon.id} className='addon-item addon-with-options'>
                    <Text className='addon-name'>{addon.name}</Text>
                    {addon.description ? <Text className='addon-desc'>{addon.description}</Text> : null}
                    <View className='addon-options-list'>
                      {addon.extra_config.options.map((opt: any, idx: number) => {
                        const qty = optionQtyMap[opt.name] || 0
                        return (
                          <View key={idx} className='addon-option-row'>
                            <View className='addon-option-info'>
                              <Text className='addon-option-name'>{opt.name}</Text>
                              {opt.description && opt.description !== opt.name ? <Text className='addon-option-desc'>{opt.description}</Text> : null}
                            </View>
                            <View className='addon-qty-row'>
                              {qty > 0 && <Text className='addon-subtotal'>¥{opt.price * qty}</Text>}
                              <View className='qty-control'>
                                <Text
                                  className={`qty-btn ${qty <= 0 ? 'disabled' : ''}`}
                                  onClick={() => changeAddonOptionQty(addon.id, opt.name, -1, limit)}
                                >-</Text>
                                <Text className='qty-value'>{qty}</Text>
                                <Text
                                  className={`qty-btn ${qty >= limit ? 'disabled' : ''}`}
                                  onClick={() => changeAddonOptionQty(addon.id, opt.name, 1, limit)}
                                >+</Text>
                              </View>
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )
              }
              // 酒店且有房型
              if (addon.category === 'hotel' && addon.extra_config?.rooms?.length > 0) {
                const roomQtyMap = addonRoomQuantities[addon.id] || {}
                return (
                  <View key={addon.id} className='addon-item addon-with-options'>
                    <Text className='addon-name'>{addon.name}</Text>
                    {addon.description ? <Text className='addon-desc'>{addon.description}</Text> : null}
                    <View className='hotel-room-cards'>
                      {addon.extra_config.rooms.map((room: any, idx: number) => {
                        const qty = roomQtyMap[room.name] || 0
                        const roomLimit = room.stock || limit
                        const imgUrl = room.images?.[0] || 'https://via.placeholder.com/200x150'
                        return (
                          <View key={idx} className='hotel-room-card-confirm'>
                            <View className='hotel-room-top-confirm' onClick={() => setSelectedRoom(room)}>
                              <Image className='hotel-room-img-confirm' src={imgUrl} mode='aspectFill' />
                              <View className='hotel-room-tags-under-img'>
                                {room.tags?.slice(0, 3).map((t: string, i: number) => (
                                  <Text key={i} className='hotel-room-tag-under'>{t}</Text>
                                ))}
                              </View>
                            </View>
                            <View className='hotel-room-body-confirm' onClick={() => setSelectedRoom(room)}>
                              <Text className='hotel-room-name-confirm'>{room.name}</Text>
                              <View className='hotel-room-specs-confirm'>
                                {room.area ? <Text className='hotel-room-spec-confirm'>{room.area}</Text> : null}
                                {room.window ? <Text className='hotel-room-spec-confirm'>{room.window}</Text> : null}
                                {room.max_guests ? <Text className='hotel-room-spec-confirm'>至多{room.max_guests}人{room.max_pets ? `/${room.max_pets}宠` : ''}</Text> : null}
                                {room.bed_type ? <Text className='hotel-room-spec-confirm'>{room.bed_type}</Text> : null}
                              </View>
                              {room.breakfast ? (
                                <View className='hotel-room-breakfast-confirm'>
                                  <Text className='hotel-room-bf-icon'>食</Text>
                                  <Text className='hotel-room-bf-text'>{room.breakfast}</Text>
                                </View>
                              ) : null}
                            </View>
                            <View className='hotel-room-action-confirm'>
                              {room.stock !== undefined ? (
                                <Text className='hotel-room-stock-confirm'>仅剩{room.stock}间</Text>
                              ) : null}
                              <View className='hotel-room-price-row-confirm'>
                                {room.original_price ? (
                                  <Text className='hotel-room-op-confirm'>¥{room.original_price}</Text>
                                ) : null}
                                <Text className='hotel-room-p-confirm'>¥{room.price}</Text>
                              </View>
                              <View className='addon-qty-row' style={{ marginTop: '8rpx' }}>
                                {qty > 0 && <Text className='addon-subtotal'>¥{room.price * qty}</Text>}
                                <View className='qty-control'>
                                  <Text className={`qty-btn ${qty <= 0 ? 'disabled' : ''}`} onClick={() => changeAddonRoomQty(addon.id, room.name, -1, roomLimit)}>-</Text>
                                  <Text className='qty-value'>{qty}</Text>
                                  <Text className={`qty-btn ${qty >= roomLimit ? 'disabled' : ''}`} onClick={() => changeAddonRoomQty(addon.id, room.name, 1, roomLimit)}>+</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )
              }
              // 普通选配
              const qty = addonQuantities[addon.id] || 0
              return (
                <View key={addon.id} className='addon-item'>
                  <View className='addon-info'>
                    <Text className='addon-name'>{addon.name}</Text>
                    <Text className='addon-desc'>{addon.description || ''}</Text>
                    <Text className='addon-price'>¥{addon.price}/{addon.unit}</Text>
                  </View>
                  <View className='addon-qty-row'>
                    {qty > 0 && <Text className='addon-subtotal'>¥{addon.price * qty}</Text>}
                    <View className='qty-control'>
                      <Text
                        className={`qty-btn ${qty <= 0 ? 'disabled' : ''}`}
                        onClick={() => changeAddonQty(addon.id, -1, limit)}
                      >-</Text>
                      <Text className='qty-value'>{qty}</Text>
                      <Text
                        className={`qty-btn ${qty >= limit ? 'disabled' : ''}`}
                        onClick={() => changeAddonQty(addon.id, 1, limit)}
                      >+</Text>
                    </View>
                  </View>
                </View>
              )
            })
          })()}
          </View>
          {addonTotal > 0 && (
            <View className='addon-total-row'>
              <Text className='addon-total-label'>行程选配合计</Text>
              <Text className='addon-total-price'>¥{addonTotal}</Text>
            </View>
          )}
        </View>
      )}

      {/* 保险服务 */}
      <View className='section-block'>
        <Text className='section-label'>【保险服务】（必选）</Text>
        <View className='insurance-row'>
          <Text className='insurance-dot'>●</Text>
          <Text className='insurance-text'>宠物意外险（{selectedPetIds.length}份） | +¥15/份 | 最高赔付5000元/份 | 合计¥{petInsuranceTotal}</Text>
        </View>
        <View className='insurance-row'>
          <Text className='insurance-dot'>●</Text>
          <Text className='insurance-text'>人身意外险（{selectedTravelers.length}份） | +¥10/份 | 最高赔付10万元/份 | 合计¥{personInsuranceTotal}</Text>
        </View>
        <Text className='insurance-tip'>投保须知：按出行人与宠物数量自动计算，不可取消</Text>
      </View>

      {/* 优惠券选择 */}
      <View className='section-block'>
        <Text className='section-label'>【优惠券】</Text>
        <View className='coupon-select-row' onClick={() => setShowCouponModal(true)}>
          {selectedCouponId && couponDiscount > 0 ? (
            <>
              <Text className='coupon-select-name'>
                {availableCoupons.find((c: any) => c.id === selectedCouponId)?.name || '优惠券'}
              </Text>
              <Text className='coupon-select-discount'>-¥{couponDiscount}</Text>
            </>
          ) : (
            <Text className='coupon-select-placeholder'>
              {availableCoupons.length > 0 ? `${availableCoupons.length}张可用` : '暂无可用优惠券'}
            </Text>
          )}
          <Text className='coupon-select-arrow'>›</Text>
        </View>
      </View>

      {/* 底部固定栏 */}
      <View className='bottom-bar'>
        <View className='bottom-price-wrap' onClick={() => setShowPriceDetail(true)}>
          <Text className='bottom-price-label'>价格明细</Text>
          <Text className='bottom-price-main'>¥{finalTotal}</Text>
        </View>
        <View className={`bottom-submit ${canSubmit ? 'active' : 'disabled'}`} onClick={handleSubmit}>提交订单</View>
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
                <Text className='price-detail-name'>
                  基础价（1人1宠）
                </Text>
                <Text className='price-detail-value'>¥{unitPrice}</Text>
              </View>
              {/* 加人 */}
              {useNewPricing && selectedTravelers.length > 1 && (
                <View className='price-detail-row sub'>
                  <Text className='price-detail-name'>　增加{selectedTravelers.length - 1}人</Text>
                  <Text className='price-detail-value'>¥{(selectedTravelers.length - 1) * extraPersonPrice}</Text>
                </View>
              )}
              {/* 加宠 */}
              {useNewPricing && selectedPetIds.length > 1 && (
                <View className='price-detail-row sub'>
                  <Text className='price-detail-name'>　增加{selectedPetIds.length - 1}宠</Text>
                  <Text className='price-detail-value'>¥{(selectedPetIds.length - 1) * extraPetPrice}</Text>
                </View>
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
              {/* 选配 */}
              {addonTotal > 0 && (
                <View className='price-detail-row'>
                  <Text className='price-detail-name'>行程选配</Text>
                  <Text className='price-detail-value'>¥{addonTotal}</Text>
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
                      <Text className='modal-item-name'>{p.name} <Text className='modal-item-phone'>{calcAge(p.birth_date)}岁 · {GENDER_MAP[p.gender] || '-'}</Text></Text>
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

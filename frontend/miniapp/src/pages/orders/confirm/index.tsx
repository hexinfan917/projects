import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { getRouteDetail, getRouteSchedules, getPets, getTravelers, createOrder } from '../../../utils/api'
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

export default function OrderConfirm() {
  const [route, setRoute] = useState<any>(null)
  const [schedule, setSchedule] = useState<any>(null)
  const [travelers, setTravelers] = useState<any[]>([])
  const [selectedTravelerIds, setSelectedTravelerIds] = useState<number[]>([])
  const [pets, setPets] = useState<any[]>([])
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([])
  const [showTravelerModal, setShowTravelerModal] = useState(false)
  const [showPetModal, setShowPetModal] = useState(false)

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
        discount_amount: 0
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
  const petInsuranceTotal = 15 * selectedPetIds.length
  const personInsuranceTotal = 10 * selectedTravelers.length
  const total = unitPrice * selectedTravelers.length + petInsuranceTotal + personInsuranceTotal
  const canSubmit = selectedTravelers.length > 0 && selectedPetIds.length > 0

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

      {/* 底部固定栏 */}
      <View className='bottom-bar'>
        <Text className='bottom-price'>实付：¥{total}</Text>
        <View className={`bottom-submit ${canSubmit ? 'active' : 'disabled'}`} onClick={handleSubmit}>提交订单</View>
      </View>

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

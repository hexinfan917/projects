import { useState, useMemo, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { getRouteAddons, getAddonCategories, getMemberCenter, IMAGE_BASE_URL } from '../../utils/api'
import './index.scss'

const FILE_BASE_URL = IMAGE_BASE_URL

// 套餐选项配置
const PACKAGE_OPTIONS = [
  { key: 'couple', label: '一人一宠', priceField: 'base_price', basePerson: 1, basePet: 1 },
  { key: 'single_person', label: '单人轻旅（无宠）', priceField: 'single_person_price', basePerson: 1, basePet: 0 },
  { key: 'single_pet', label: '毛孩专属接送（无主人陪同）', priceField: 'single_pet_price', basePerson: 0, basePet: 1 },
]

interface BookingPopupProps {
  visible: boolean
  route: any
  schedules: any[]
  initialDate?: string
  onClose: () => void
  onNext: (data: any) => void
}

export default function BookingPopup({ visible, route, schedules, initialDate, onClose, onNext }: BookingPopupProps) {
  const isFree = route?.is_free === 1
  const [selectedPackage, setSelectedPackage] = useState('couple')
  const [extraPerson, setExtraPerson] = useState(0)
  const [extraPet, setExtraPet] = useState(0)
  const [travelType, setTravelType] = useState<'bus' | 'self_drive'>('bus')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const hasInitializedRef = useRef(false)
  const userChangedRef = useRef(false)
  const [addonQuantities, setAddonQuantities] = useState<Record<number, number>>({})
  const [addons, setAddons] = useState<any[]>([])
  const [isMember, setIsMember] = useState(false)

  // 获取会员状态
  useEffect(() => {
    if (visible) {
      getMemberCenter().then(res => {
        setIsMember(!!res.data?.is_member)
      }).catch(() => setIsMember(false))
    }
  }, [visible])

  // 计算排期最低价套餐与出行方式
  const getBestPackage = (schedule: any) => {
    if (isFree) return { packageKey: 'couple', travelType: 'bus' as const }
    const candidates: { packageKey: string, travelType: 'bus' | 'self_drive', price: number }[] = []
    if (schedule.travel_type !== 2) {
      candidates.push(
        { packageKey: 'couple', travelType: 'bus', price: isMember && schedule.member_price != null ? schedule.member_price : schedule.price },
        { packageKey: 'single_person', travelType: 'bus', price: isMember && schedule.member_single_person_price != null ? schedule.member_single_person_price : schedule.single_person_price },
        { packageKey: 'single_pet', travelType: 'bus', price: isMember && schedule.member_single_pet_price != null ? schedule.member_single_pet_price : schedule.single_pet_price },
      )
    }
    if (schedule.travel_type !== 1) {
      candidates.push(
        { packageKey: 'couple', travelType: 'self_drive', price: isMember && schedule.member_self_drive_price != null ? schedule.member_self_drive_price : schedule.self_drive_price },
        { packageKey: 'single_person', travelType: 'self_drive', price: isMember && schedule.member_self_drive_single_person_price != null ? schedule.member_self_drive_single_person_price : schedule.self_drive_single_person_price },
      )
    }
    const available = candidates.filter(c => c.price != null && c.price > 0)
    if (available.length === 0) return null
    return available.reduce((min, c) => (c.price < min.price ? c : min))
  }

  // 弹窗打开时默认选中传入日期或第一个可用日期，并默认选中最低价套餐
  useEffect(() => {
    if (visible) {
      const dates = Object.keys(scheduleMap)
      // 每次打开弹窗都重新初始化，确保传入的 initialDate 被正确应用
      hasInitializedRef.current = true
      userChangedRef.current = false
      let targetDate: string | null = null
      if (initialDate && scheduleMap[initialDate]) {
        targetDate = initialDate
        setSelectedDate(initialDate)
      } else if (dates.length > 0) {
        targetDate = dates[0]
        setSelectedDate(dates[0])
      }
      if (targetDate) {
        const best = getBestPackage(scheduleMap[targetDate])
        if (best) {
          setSelectedPackage(best.packageKey)
          setTravelType(best.travelType)
        }
      }
    } else {
      hasInitializedRef.current = false
      userChangedRef.current = false
    }
  }, [visible, scheduleMap, initialDate])

  // 会员状态返回后，若用户未手动修改，重新应用最低价套餐
  useEffect(() => {
    if (visible && selectedDate && !userChangedRef.current) {
      const best = getBestPackage(scheduleMap[selectedDate])
      if (best) {
        setSelectedPackage(best.packageKey)
        setTravelType(best.travelType)
      }
    }
  }, [isMember, visible, selectedDate, scheduleMap])

  // 加载行程选配
  useEffect(() => {
    if (visible && route?.id) {
      loadAddons()
    }
  }, [visible, route?.id])

  const loadAddons = async () => {
    try {
      const [cRes, aRes] = await Promise.all([
        getAddonCategories(),
        getRouteAddons(route.id)
      ])
      const list = aRes.data?.addons || []
      setAddons(list)
      // 初始化默认数量
      const defaultQty: Record<number, number> = {}
      list.forEach((a: any) => {
        defaultQty[a.id] = a.is_required ? 1 : 0
      })
      setAddonQuantities(defaultQty)
    } catch (err) {
      console.error('加载选配失败', err)
    }
  }

  // 排期数据
  const scheduleMap = useMemo(() => {
    const map: Record<string, any> = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    schedules.forEach(s => {
      if (s.schedule_date) {
        const d = new Date(s.schedule_date + 'T00:00:00')
        if (d >= today) {
          map[s.schedule_date] = s
        }
      }
    })
    return map
  }, [schedules])

  // 当前选中排期的出行方式限制 0两者都支持 1仅大巴 2仅自驾
  const scheduleTravelType = useMemo(() => {
    if (selectedDate) {
      const schedule = scheduleMap[selectedDate]
      return schedule?.travel_type ?? 0
    }
    return 0
  }, [selectedDate, scheduleMap])

  // 根据排期的 travel_type 自动调整交通方式
  useEffect(() => {
    if (!isFree && selectedDate) {
      const type = scheduleTravelType
      if (type === 1 && travelType !== 'bus') {
        setTravelType('bus')
      } else if (type === 2 && travelType !== 'self_drive') {
        setTravelType('self_drive')
        // 清理座位类 addon
        setAddonQuantities(prev => {
          const next = { ...prev }
          addons.forEach((a: any) => {
            const isSeatAddon = a.category === 'seat' || (a.name || '').includes('座位')
            if (isSeatAddon) next[a.id] = 0
          })
          return next
        })
      }
    }
  }, [scheduleTravelType, isFree, selectedDate, addons])

  // 当前套餐配置
  const pkgConfig = PACKAGE_OPTIONS.find(p => p.key === selectedPackage)!

  // 动态价格字段
  const priceField = travelType === 'self_drive'
    ? `self_drive_${pkgConfig.priceField}`
    : pkgConfig.priceField

  // 排期字段映射（route 的 base_price 对应 schedule 的 price）
  const schedulePriceField = pkgConfig.priceField === 'base_price'
    ? (travelType === 'self_drive' ? 'self_drive_price' : 'price')
    : priceField
  const memberPriceField = pkgConfig.priceField === 'base_price'
    ? (travelType === 'self_drive' ? 'member_self_drive_price' : 'member_price')
    : `member_${priceField}`

  // 价格完全从排期取（不再回退到路线默认价）
  const basePrice = (() => {
    if (selectedDate) {
      const schedule = scheduleMap[selectedDate]
      if (schedule && schedule[schedulePriceField] != null) {
        const mp = schedule[memberPriceField]
        if (isMember && mp != null) return mp
        return schedule[schedulePriceField]
      }
    }
    return 0
  })()

  const extraPersonPrice = (() => {
    const scheduleField = travelType === 'self_drive' ? 'self_drive_extra_person_price' : 'extra_person_price'
    const memberField = travelType === 'self_drive' ? 'member_self_drive_extra_person_price' : 'member_extra_person_price'
    if (selectedDate) {
      const schedule = scheduleMap[selectedDate]
      if (schedule && schedule[scheduleField] != null) {
        const mp = schedule[memberField]
        if (isMember && mp != null) return mp
        return schedule[scheduleField]
      }
    }
    return 0
  })()

  const extraPetPrice = (() => {
    const scheduleField = travelType === 'self_drive' ? 'self_drive_extra_pet_price' : 'extra_pet_price'
    const memberField = travelType === 'self_drive' ? 'member_self_drive_extra_pet_price' : 'member_extra_pet_price'
    if (selectedDate) {
      const schedule = scheduleMap[selectedDate]
      if (schedule && schedule[scheduleField] != null) {
        const mp = schedule[memberField]
        if (isMember && mp != null) return mp
        return schedule[scheduleField]
      }
    }
    return 0
  })()

  // 是否可以增加宠物/成人
  const canAddPet = pkgConfig.basePet > 0 || selectedPackage === 'single_pet'
  const canAddPerson = pkgConfig.basePerson > 0 || selectedPackage === 'single_person'

  // 获取日期卡片展示价格（只取排期当日价格）
  const getDisplayPrice = (schedule: any) => {
    if (!schedule) return 0
    // 仅自驾排期用 member_self_drive_price，仅大巴/两者都用 member_price
    const isSelfDriveOnly = schedule.travel_type === 2
    const isBusOnly = schedule.travel_type === 1
    const mp = isSelfDriveOnly ? schedule.member_self_drive_price
      : (isBusOnly ? schedule.member_price
      : (schedule.member_price != null ? schedule.member_price : schedule.member_self_drive_price))
    if (isMember && mp != null) return mp
    return isSelfDriveOnly ? (schedule.self_drive_price || 0) : (schedule.price || 0)
  }

  // 获取 addon 排期级价格（优先）或路线默认价格
  const getAddonPrice = (addon: any) => {
    if (selectedDate && scheduleMap[selectedDate]) {
      const scheduleAddonPrices = scheduleMap[selectedDate].addon_prices || {}
      const code = addon.code || `addon_${addon.id}`
      if (scheduleAddonPrices[code] != null) {
        return Number(scheduleAddonPrices[code])
      }
    }
    return addon.price || 0
  }

  // 总价计算
  const totalPrice = useMemo(() => {
    let price = basePrice
    price += extraPerson * extraPersonPrice
    price += extraPet * extraPetPrice
    addons.forEach(a => {
      const qty = addonQuantities[a.id] || 0
      const isSeatAddon = a.category === 'seat' || (a.name || '').includes('座位')
      // 座位类addon：自驾时跳过（不需要大巴座位），大巴时正常计算
      if (isSeatAddon && travelType === 'self_drive') return
      price += qty * getAddonPrice(a)
    })
    return Math.max(0, price)
  }, [basePrice, extraPerson, extraPet, extraPersonPrice, extraPetPrice, addonQuantities, addons, selectedDate, scheduleMap])

  // 切换套餐
  const handlePackageChange = (key: string) => {
    userChangedRef.current = true
    setSelectedPackage(key)
    const cfg = PACKAGE_OPTIONS.find(p => p.key === key)!
    if (cfg.basePet === 0) setExtraPet(0)
    if (cfg.basePerson === 0) setExtraPerson(0)
  }

  // 切换交通方式
  const handleTravelTypeChange = (type: 'bus' | 'self_drive') => {
    userChangedRef.current = true
    setTravelType(type)
    if (type === 'self_drive') {
      // Only clear seat addons, keep non-seat addons
      setAddonQuantities(prev => {
        const next = { ...prev }
        addons.forEach(a => {
          const isSeatAddon = a.category === 'seat' || (a.name || '').includes('座位')
          if (isSeatAddon) next[a.id] = 0
        })
        return next
      })
    }
  }

  // 选配数量调整
  const changeAddonQty = (addonId: number, delta: number) => {
    setAddonQuantities(prev => {
      const current = prev[addonId] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [addonId]: next }
    })
  }

  // 下一步
  const handleNext = () => {
    if (!selectedDate) {
      Taro.showToast({ title: '请选择出发日期', icon: 'none' })
      return
    }
    const schedule = scheduleMap[selectedDate]
    if (!schedule) {
      Taro.showToast({ title: '日期无效', icon: 'none' })
      return
    }
    const cfg = pkgConfig
    const selectedAddons = addons
      .filter(a => (addonQuantities[a.id] || 0) > 0)
      .map(a => ({ ...a, quantity: addonQuantities[a.id], price: getAddonPrice(a) }))

    // 免费路线固定参数（只能1人1宠，不允许额外增加，全部自驾）
    if (isFree) {
      onNext({
        scheduleId: schedule.id,
        travelDate: selectedDate,
        packageType: 'couple',
        basePerson: 1,
        basePet: 1,
        extraPerson: 0,
        extraPet: 0,
        travelType: 'self_drive',
        addons: [],
        totalPrice: 0,
      })
      return
    }

    onNext({
      scheduleId: schedule.id,
      travelDate: selectedDate,
      packageType: selectedPackage,
      basePerson: cfg.basePerson,
      basePet: cfg.basePet,
      extraPerson,
      extraPet,
      travelType,
      addons: selectedAddons,
      totalPrice,
    })
  }

  if (!visible) return null

  const coverUrl = route?.cover_image
    ? (route.cover_image.startsWith('http') ? route.cover_image : `${FILE_BASE_URL}${route.cover_image}`)
    : ''

  const selectedPkgLabel = PACKAGE_OPTIONS.find(p => p.key === selectedPackage)?.label || ''

  return (
    <View className='booking-popup'>
      <View className='popup-mask' onClick={onClose} catchMove />
      <View className='popup-content'>
        {/* 顶部关闭 */}
        <View className='popup-header'>
          <Text className='popup-title'>选择交通方式 · 套餐 · 人数</Text>
          <Text className='popup-close' onClick={onClose}>✕</Text>
        </View>

        <ScrollView className='popup-scroll' scrollY>
          <View className='popup-body'>
            {/* 路线信息卡 */}
          <View className='route-card'>
            {coverUrl && <Image className='route-cover' src={coverUrl} mode='aspectFill' />}
            <View className='route-info'>
              <Text className='route-name'>{route?.name || ''}</Text>
              {!isFree && (
              <View className='route-price-row'>
                <Text className='route-price-label'>销售价</Text>
                <Text className='route-price'>¥{basePrice}</Text>
                <Text className='route-price-unit'>起</Text>
              </View>
            )}
              {selectedDate && (
                <Text className='route-selected-date'>
                  已选 {selectedDate.slice(5).replace('-', '月')}日
                </Text>
              )}
            </View>
          </View>

          {/* 交通方式 —— 免费路线隐藏 */}
          {!isFree && scheduleTravelType !== 1 && scheduleTravelType !== 2 && (
            <View className='section'>
              <Text className='section-title'>交通方式</Text>
              <View className='travel-type-list'>
                <View
                  className={`travel-type-item ${travelType === 'bus' ? 'active' : ''}`}
                  onClick={() => handleTravelTypeChange('bus')}
                >
                  <Text className='travel-type-name'>大巴出行</Text>
                  <Text className='travel-type-desc'>含往返大巴费用</Text>
                </View>
                <View
                  className={`travel-type-item ${travelType === 'self_drive' ? 'active' : ''}`}
                  onClick={() => handleTravelTypeChange('self_drive')}
                >
                  <Text className='travel-type-name'>自行前往</Text>
                  <Text className='travel-type-desc'>自驾前往集合点</Text>
                </View>
              </View>
            </View>
          )}
          {!isFree && scheduleTravelType === 1 && (
            <View className='section'>
              <Text className='section-title'>交通方式</Text>
              <View className='travel-type-list'>
                <View className='travel-type-item active'>
                  <Text className='travel-type-name'>大巴出行</Text>
                  <Text className='travel-type-desc'>含往返大巴费用</Text>
                </View>
              </View>
            </View>
          )}
          {!isFree && scheduleTravelType === 2 && (
            <View className='section'>
              <Text className='section-title'>交通方式</Text>
              <View className='travel-type-list'>
                <View className='travel-type-item active'>
                  <Text className='travel-type-name'>自行前往</Text>
                  <Text className='travel-type-desc'>自驾前往集合点</Text>
                </View>
              </View>
            </View>
          )}

          {/* 尾巴出行 —— 免费路线只保留增加人宠 */}
          <View className='section'>
            {!isFree && (
              <>
                <Text className='section-title'>尾巴出行</Text>
                <View className='package-list'>
                  {PACKAGE_OPTIONS.filter(pkg => !(travelType === 'self_drive' && pkg.key === 'single_pet')).map(pkg => {
                    const pkgPriceField = travelType === 'self_drive'
                      ? `self_drive_${pkg.priceField}`
                      : pkg.priceField
                    const scheduleField = pkg.priceField === 'base_price'
                      ? (travelType === 'self_drive' ? 'self_drive_price' : 'price')
                      : pkgPriceField
                    let price = 0
                    let hasPrice = false
                    if (selectedDate) {
                      const schedule = scheduleMap[selectedDate]
                      if (schedule) {
                        const field = pkg.priceField === 'base_price'
                          ? (travelType === 'self_drive' ? 'self_drive_price' : 'price')
                          : (travelType === 'self_drive' ? `self_drive_${pkg.priceField}` : pkg.priceField)
                        const memberField = pkg.priceField === 'base_price'
                          ? (travelType === 'self_drive' ? 'member_self_drive_price' : 'member_price')
                          : `member_${travelType === 'self_drive' ? `self_drive_${pkg.priceField}` : pkg.priceField}`
                        if (schedule[field] != null) {
                          price = schedule[field]
                          hasPrice = true
                        }
                        // 会员优先使用会员价
                        if (isMember && schedule[memberField] != null) {
                          price = schedule[memberField]
                        }
                      }
                    }
                    const isActive = selectedPackage === pkg.key
                    return (
                      <View
                        key={pkg.key}
                        className={`package-item ${isActive ? 'active' : ''} ${!hasPrice ? 'disabled' : ''} ${pkg.key === 'single_pet' ? 'full-width' : ''}`}
                        onClick={() => hasPrice && handlePackageChange(pkg.key)}
                      >
                        <View className='package-left'>
                          <View className='package-check'>
                            {isActive && <Text className='package-check-icon'>✓</Text>}
                          </View>
                          <Text className='package-label'>{pkg.label}</Text>
                        </View>
                        <View className='package-right'>
                          {hasPrice ? (
                            <Text className='package-price'>¥{price}</Text>
                          ) : (
                            <Text className='package-unconfigured'>未配置</Text>
                          )}
                        </View>
                      </View>
                    )
                  })}
                </View>
              </>
            )}

            {/* 额外人员 —— 免费路线隐藏 */}
            {!isFree && (canAddPerson || canAddPet) && (
              <View className='counter-wrap'>
                {canAddPerson && (
                  <View className='counter-row'>
                    <Text className='counter-label'>增加成人</Text>
                    <View className='counter-right'>
                      <Text className='counter-unit-price'>¥{extraPersonPrice}/人</Text>
                      <View className='counter-control'>
                        <Text
                          className={`counter-btn minus ${extraPerson <= 0 ? 'disabled' : ''}`}
                          onClick={() => setExtraPerson(Math.max(0, extraPerson - 1))}
                        >-</Text>
                        <Text className='counter-value'>{extraPerson}</Text>
                        <Text className='counter-btn' onClick={() => setExtraPerson(extraPerson + 1)}>+</Text>
                      </View>
                    </View>
                  </View>
                )}
                {canAddPet && (
                  <View className='counter-row'>
                    <Text className='counter-label'>增加宠物</Text>
                    <View className='counter-right'>
                      <Text className='counter-unit-price'>¥{extraPetPrice}/宠</Text>
                      <View className='counter-control'>
                        <Text
                          className={`counter-btn minus ${extraPet <= 0 ? 'disabled' : ''}`}
                          onClick={() => setExtraPet(Math.max(0, extraPet - 1))}
                        >-</Text>
                        <Text className='counter-value'>{extraPet}</Text>
                        <Text className='counter-btn' onClick={() => setExtraPet(extraPet + 1)}>+</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* 大巴费用 - 行程选配（仅座位分类） —— 免费路线隐藏 */}
          {!isFree && travelType === 'bus' && addons.filter((a: any) => a.category === 'seat' || (a.name || '').includes('座位')).length > 0 && (
            <View className='addon-section'>
              <Text className='section-title'>大巴费用（往返）</Text>
              <View className='addon-list'>
                {addons
                  .filter((a: any) => a.category === 'seat' || (a.name || '').includes('座位'))
                  .map((addon: any) => (
                    <View key={addon.id} className='addon-item'>
                      <View className='addon-info'>
                        <Text className='addon-name'>{addon.name}</Text>
                        <Text className='addon-desc'>{addon.description || ''}</Text>
                      </View>
                      <View className='addon-control'>
                        <Text className='addon-price'>¥{getAddonPrice(addon)}</Text>
                        <View className='counter-control'>
                          <Text
                            className={`counter-btn minus ${(addonQuantities[addon.id] || 0) <= 0 ? 'disabled' : ''}`}
                            onClick={() => changeAddonQty(addon.id, -1)}
                          >-</Text>
                          <Text className='counter-value'>{addonQuantities[addon.id] || 0}</Text>
                          <Text className='counter-btn' onClick={() => changeAddonQty(addon.id, 1)}>+</Text>
                        </View>
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* 其他行程选配（非座位类） —— 免费路线隐藏 */}
          {!isFree && addons.filter((a: any) => a.category !== 'seat' && !(a.name || '').includes('座位')).length > 0 && (
            <View className='addon-section'>
              <Text className='section-title'>行程选配</Text>
              <View className='addon-list'>
                {addons
                  .filter((a: any) => a.category !== 'seat' && !(a.name || '').includes('座位'))
                  .map((addon: any) => (
                    <View key={addon.id} className='addon-item'>
                      <View className='addon-info'>
                        <Text className='addon-name'>{addon.name}</Text>
                        <Text className='addon-desc'>{addon.description || ''}</Text>
                      </View>
                      <View className='addon-control'>
                        <Text className='addon-price'>¥{getAddonPrice(addon)}</Text>
                        <View className='counter-control'>
                          <Text
                            className={`counter-btn minus ${(addonQuantities[addon.id] || 0) <= 0 ? 'disabled' : ''}`}
                            onClick={() => changeAddonQty(addon.id, -1)}
                          >-</Text>
                          <Text className='counter-value'>{addonQuantities[addon.id] || 0}</Text>
                          <Text className='counter-btn' onClick={() => changeAddonQty(addon.id, 1)}>+</Text>
                        </View>
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          )}
          </View>
        </ScrollView>

        {/* 底部汇总 */}
        <View className='popup-footer'>
          <View className='footer-info'>
            {!isFree && <Text className='footer-tag'>{selectedPkgLabel}</Text>}
            <Text className='footer-tag'>{route?.duration || ''}</Text>
            {selectedDate && (
              <Text className='footer-tag-green'>{selectedDate}</Text>
            )}
          </View>
          <View className='footer-price-row'>
            <View className='footer-price-left'>
              <View className='footer-price-main'>
                <Text className='footer-price-label'>{isFree ? '费用' : '合计'}</Text>
                <Text className='footer-total'>{isFree ? '免费' : `¥${totalPrice}`}</Text>
              </View>
            </View>
            <View
              className={`next-btn ${!selectedDate ? 'disabled' : ''}`}
              onClick={handleNext}
            >
              <Text>{isFree ? '确认报名' : '下一步'}</Text>
              <Text className='next-btn-arrow'>→</Text>
            </View>
          </View>
        </View>
      </View>

    </View>
  )
}

import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Button, Image, ScrollView } from '@tarojs/components'
import { getOrderDetail, cancelOrder, safeNavigateBack, compressImageUrl } from '../../../utils/api'
import './index.scss'

const STATUS_MAP: any = {
  10: '待支付',
  20: '待出行',
  30: '已取消',
  40: '退款中',
  45: '退款驳回',
  50: '已退款',
  55: '部分退款',
  60: '已完成',
  70: '已评价'
}

const STATUS_SUBTITLE: any = {
  10: '请在规定时间内完成支付',
  20: '订单已确认，静待出发',
  30: '订单已取消，期待再次相遇',
  40: '退款申请处理中，请耐心等待',
  45: '退款申请未通过，可联系客服',
  50: '订单已全额退款',
  55: '订单已部分退款',
  60: '行程已完成，欢迎评价',
  70: '感谢您的评价'
}

const GENDER_MAP: any = { 0: '/assets/icons/icon-female.svg', 1: '/assets/icons/icon-male.svg' }
const BREED_TYPE_MAP: any = { 1: '小型', 2: '中型', 3: '大型', 4: '巨型' }

// 套餐类型映射
const PACKAGE_TYPE_MAP: any = {
  couple: '一人一宠',
  single_person: '单人轻旅（无宠）',
  single_pet: '毛孩专属接送（无主人陪同）'
}

// 出行方式映射
const TRAVEL_TYPE_MAP: any = {
  bus: '大巴出行',
  self_drive: '自驾出行'
}

function fullImageUrl(url?: string) {
  if (!url) return ''
  return compressImageUrl(url, 200)
}

function formatAge(ageStr?: string, birthDate?: string) {
  if (ageStr) {
    const s = String(ageStr).trim()
    if (!s) return ''
    if (/[岁半]/.test(s)) return s
    return s + '岁'
  }
  if (birthDate) {
    const birth = new Date(birthDate)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
    return age > 0 ? age + '岁' : ''
  }
  return ''
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  return String(dateStr).split('T')[0]
}

export default function OrderDetail() {
  const [order, setOrder] = useState<any>(null)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadOrder(Number(id))
    }
  }, [])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadOrder(Number(id))
    }
  })

  const loadOrder = async (id: number) => {
    const res = await getOrderDetail(id)
    setOrder(res.data)
  }

  const onRefresh = async () => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (!id) return
    setRefreshing(true)
    try {
      await loadOrder(Number(id))
    } finally {
      setRefreshing(false)
    }
  }

  const handleCancel = async () => {
    try {
      await cancelOrder(order.id)
      Taro.showToast({ title: '取消成功', icon: 'success' })
      loadOrder(order.id)
    } catch (err) {
      Taro.showToast({ title: '取消失败', icon: 'none' })
    }
  }

  const goRefund = () => {
    Taro.navigateTo({ url: `/pages/orders/refund/index?id=${order.id}` })
  }

  const goPay = () => {
    Taro.navigateTo({ url: `/pages/orders/pay/index?id=${order.id}` })
  }

  if (!order) return <View className='order-detail'><Text className='loading-text'>加载中...</Text></View>

  const actualPay = Number(order.pay_amount || 0)
  const refunded = Number(order.refunded_amount || 0)
  const actualConsume = actualPay - refunded

  return (
    <View className='order-detail'>
      {/* 顶部导航 */}
      <View className='detail-navbar'>
        <View className='page-back' onClick={() => {
          const pages = Taro.getCurrentPages()
          if (pages.length > 1) {
            safeNavigateBack()
          } else {
            Taro.switchTab({ url: '/pages/index/index' })
          }
        }}>
          <View className='page-back-arrow' />
        </View>
      </View>

      <ScrollView
        className='detail-scroll'
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        {/* 状态卡片 */}
        <View className='status-card'>
          <Text className='status-main'>{STATUS_MAP[order.status] || '未知'}</Text>
          <Text className='status-sub'>{STATUS_SUBTITLE[order.status] || ''}</Text>
        </View>

        {order.refund_reject_reason && order.status === 45 && (
          <View className='reject-card'>
            <Text className='reject-title'>退款申请未通过</Text>
            <Text className='reject-reason'>原因：{order.refund_reject_reason}</Text>
            <Text className='reject-tip'>您可点击"重新申请"再次提交</Text>
          </View>
        )}

        {/* 活动详情 */}
        <View className='section'>
          <View className='section-header'>
            <Image className='section-icon' src='/assets/icons/icon-calendar.svg' mode='aspectFit' />
            <Text className='section-title'>活动详情</Text>
          </View>
          <View className='info-card'>
            <Text className='route-name'>{order.route_name}</Text>
            {/* 套餐类型标签 */}
            <View className='package-tag-row'>
              <Text className={`package-tag ${order.package_type === 'single_person' ? 'package-single' : 'package-couple'}`}>
                {PACKAGE_TYPE_MAP[order.package_type] || (order.pet_count === 0 ? '单人轻旅（无宠）' : '一人一宠')}
              </Text>
              {order.travel_type && (
                <Text className='travel-type-tag'>
                  {TRAVEL_TYPE_MAP[order.travel_type] || order.travel_type}
                </Text>
              )}
            </View>
            <View className='detail-row'>
              <View className='detail-icon-wrap'>
                <Image className='detail-icon' src='/assets/icons/icon-calendar.svg' mode='aspectFit' />
              </View>
              <Text className='detail-text'>{order.travel_date}</Text>
            </View>
            <View className='detail-row'>
              <View className='detail-icon-wrap'>
                <Image className='detail-icon' src='/assets/icons/icon-people.svg' mode='aspectFit' />
              </View>
              <Text className='detail-text'>成人：{order.participant_count}人 | 宠物：{order.pet_count}只</Text>
            </View>
          </View>
        </View>

        {/* 出行人与宠物 */}
        {(order.contact?.name || (order.participants && order.participants.length > 0) || (order.pets && order.pets.length > 0)) && (
          <View className='section'>
            <View className='section-header'>
              <Image className='section-icon' src='/assets/icons/icon-paw.svg' mode='aspectFit' />
              <Text className='section-title'>出行人与宠物</Text>
            </View>
            <View className='info-card'>
              {/* 所有出行人（统一显示为出行人） */}
              {(order.contact?.name || (order.participants && order.participants.length > 0)) && (
                <View className='travelers-section'>
                  {/* 合并联系人和所有参与者，统一显示 */}
                  {(() => {
                    // 收集所有出行人：联系人 + participants
                    const allTravelers: any[] = []
                    if (order.contact?.name) {
                      allTravelers.push({
                        name: order.contact.name,
                        phone: order.contact.phone || '',
                        id_card: order.contact.id_card || '',
                      })
                    }
                    if (order.participants && order.participants.length > 0) {
                      order.participants.forEach((p: any) => {
                        // 避免重复（根据手机号）
                        const exists = allTravelers.some(t => t.phone && t.phone === p.phone)
                        if (!exists) {
                          allTravelers.push({
                            name: p.name || '未命名',
                            phone: p.phone || '',
                            id_card: p.id_card || '',
                          })
                        }
                      })
                    }
                    return allTravelers.map((traveler, idx) => (
                      <View key={idx} className={`traveler-item ${idx < allTravelers.length - 1 ? 'traveler-item-border' : ''}`}>
                        <View className='traveler-row'>
                          <Text className='traveler-label'>出行人</Text>
                          <Text className='traveler-name'>{traveler.name}</Text>
                        </View>
                        <View className='traveler-info-row'>
                          <Text className='traveler-info-label'>身份证号</Text>
                          <Text className='traveler-info-value'>{traveler.id_card || '-'}</Text>
                        </View>
                        <View className='traveler-info-row'>
                          <Text className='traveler-info-label'>手机号</Text>
                          <Text className='traveler-info-value'>{traveler.phone || '-'}</Text>
                        </View>
                      </View>
                    ))
                  })()}
                </View>
              )}

              {/* 宠物信息 */}
              {/* 宠物信息 */}
              {order.pets && order.pets.map((pet: any, idx: number) => {
                const avatarUrl = fullImageUrl(pet.avatar)
                const genderIcon = GENDER_MAP[pet.gender]
                const ageText = formatAge(pet.age_str, pet.birth_date)
                const vaccineDate = formatDate(pet.vaccine_date)
                const vaccineBookUrl = fullImageUrl(pet.vaccine_book)
                const petCount = order.pets ? order.pets.length : 0
                const isLast = idx === petCount - 1
                return (
                  <View key={`pet-${idx}`} className={isLast ? 'pet-detail-card' : 'pet-detail-card pet-detail-card-bordered'}>
                    <View className='pet-detail-header'>
                      {avatarUrl ? (
                        <Image className='pet-avatar' src={avatarUrl} mode='aspectFill' />
                      ) : (
                        <View className='pet-avatar-placeholder'>
                          <Text className='pet-avatar-text'>{pet.name ? pet.name.charAt(0) : '宠'}</Text>
                        </View>
                      )}
                      <View className='pet-detail-title'>
                        <View className='pet-name-row'>
                          <Text className='pet-name'>{pet.name}</Text>
                          {genderIcon && <Image className='pet-gender-icon' src={genderIcon} mode='aspectFit' />}
                          {pet.is_default ? <Text className='pet-default-tag'>默认</Text> : null}
                        </View>
                        <View className='pet-tags'>
                          {ageText ? <Text className='pet-tag'>{ageText}</Text> : null}
                          {pet.breed ? <Text className='pet-tag'>{pet.breed}</Text> : null}
                          {pet.weight ? <Text className='pet-tag'>{pet.weight}kg</Text> : null}
                        </View>
                      </View>
                    </View>
                    <View className='pet-meta-list'>
                      <View className='pet-meta-item'>
                        <Text className='pet-meta-label'>疫苗时间</Text>
                        <Text className='pet-meta-value'>{vaccineDate || '-'}</Text>
                      </View>
                      {pet.breed_type && (
                        <View className='pet-meta-item'>
                          <Text className='pet-meta-label'>体型</Text>
                          <Text className='pet-meta-value'>{BREED_TYPE_MAP[pet.breed_type] || pet.breed_type}</Text>
                        </View>
                      )}
                      {pet.health_notes && (
                        <View className='pet-meta-item'>
                          <Text className='pet-meta-label'>健康备注</Text>
                          <Text className='pet-meta-value'>{pet.health_notes}</Text>
                        </View>
                      )}
                      {pet.tags && pet.tags.length > 0 && (
                        <View className='pet-meta-item'>
                          <Text className='pet-meta-label'>性格标签</Text>
                          <View className='pet-personality-tags'>
                            {pet.tags.map((tag: string, tidx: number) => (
                              <Text key={`tag-${idx}-${tidx}`} className='pet-personality-tag'>{tag}</Text>
                            ))}
                          </View>
                        </View>
                      )}
                      {vaccineBookUrl && (
                        <View className='pet-meta-item'>
                          <Text className='pet-meta-label'>疫苗本</Text>
                          <Image
                            className='pet-vaccine-book'
                            src={vaccineBookUrl}
                            mode='aspectFill'
                            onClick={() => Taro.previewImage({ current: vaccineBookUrl, urls: [vaccineBookUrl] })}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* 费用明细 */}
        <View className='section'>
          <View className='section-header'>
            <Image className='section-icon' src='/assets/icons/icon-gift.svg' mode='aspectFit' />
            <Text className='section-title'>费用明细</Text>
          </View>
          <View className='info-card fee-card'>
            <View className='fee-row'>
              <Text className='fee-label'>路线费用</Text>
              <Text className='fee-value'>¥ {order.is_free === 1 ? '0（免费）' : order.route_price}</Text>
            </View>
            {order.insurance_price > 0 && (
              <View className='fee-row'>
                <Text className='fee-label'>保险费用</Text>
                <Text className='fee-value'>¥ {order.insurance_price}</Text>
              </View>
            )}
            {order.discount_amount > 0 && (
              <View className='fee-row'>
                <Text className='fee-label'>优惠金额</Text>
                <Text className='fee-value discount'>- ¥ {order.discount_amount}</Text>
              </View>
            )}
            <View className='fee-divider' />
            <View className='fee-total'>
              <Text className='fee-total-label'>实付金额</Text>
              <View className='fee-total-right'>
                <Text className='fee-total-tip'>应付合计</Text>
                <Text className='fee-total-value'>¥ {actualPay}</Text>
              </View>
            </View>
            {refunded > 0 && (
              <>
                <View className='fee-divider' />
                <View className='fee-row'>
                  <Text className='fee-label'>已退金额</Text>
                  <Text className='fee-value refund'>¥ {refunded.toFixed(2)}</Text>
                </View>
                <View className='fee-row fee-final-row'>
                  <Text className='fee-label'>实际消费</Text>
                  <Text className='fee-value fee-final'>¥ {actualConsume.toFixed(2)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 退款记录 */}
        {order.refund_records && order.refund_records.length > 0 && (
          <View className='section'>
            <View className='section-header'>
              <Image className='section-icon' src='/assets/icons/icon-shield.svg' mode='aspectFit' />
              <Text className='section-title'>退款记录</Text>
            </View>
            <View className='info-card'>
              {order.refund_records.map((r: any, idx: number) => (
                <View key={idx} className='refund-record-row'>
                  <Text className='refund-record-type'>
                    {r.type === 'full' ? '全额退款' : '部分退款'} ¥{r.amount}
                  </Text>
                  <Text className='refund-record-status'>
                    {r.status === 20 ? '成功' : r.status === 30 ? '失败' : '处理中'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className='safe-bottom' />
      </ScrollView>

      {/* 底部操作 */}
      <View className='action-bar'>
        {order.status === 10 && (
          <View className='action-btns'>
            <Button className='btn-outline' onClick={handleCancel}>取消订单</Button>
            <Button className='btn-primary' onClick={goPay}>去支付</Button>
          </View>
        )}
        {order.status === 20 && (
          <View className='action-btns'>
            <Button className='btn-outline' onClick={handleCancel}>取消订单</Button>
            <Button className='btn-primary' onClick={() => setQrModalVisible(true)}>联系客服</Button>
          </View>
        )}
        {order.status === 45 && (
          <View className='action-btns'>
            <Button className='btn-outline' onClick={() => setQrModalVisible(true)}>联系客服</Button>
            {actualPay > 0 && (
              <Button className='btn-outline' onClick={goRefund}>重新申请</Button>
            )}
          </View>
        )}
        {(order.status === 30 || order.status === 40 || order.status === 50 || order.status === 55 || order.status === 60 || order.status === 70) && (
          <View className='action-btns'>
            <Button className='btn-primary' onClick={() => setQrModalVisible(true)}>联系客服</Button>
          </View>
        )}
      </View>

      {qrModalVisible && (
        <View className='qr-modal' onClick={() => setQrModalVisible(false)}>
          <View className='qr-modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='qr-modal-title'>联系客服</Text>
            <Image
              className='qr-image'
              src={require('../../../assets/images/customer-service.jpg')}
              mode='widthFix'
              showMenuByLongpress
              onError={() => Taro.showToast({ title: '图片加载失败', icon: 'none' })}
            />
            <Text className='qr-modal-tip'>长按二维码识别，添加客服</Text>
            <View className='qr-modal-close' onClick={() => setQrModalVisible(false)}>
              <Text>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

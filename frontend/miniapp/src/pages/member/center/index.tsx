import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getMemberCenter, getMemberCoupons, createMemberOrder, payMemberOrder } from '../../../utils/api'
import './index.scss'

const TYPE_MAP: Record<number, string> = { 1: '满减券', 2: '折扣券', 3: '立减券' }

export default function MemberCenter() {
  const [data, setData] = useState<any>(null)
  const [coupons, setCoupons] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useDidShow(() => {
    loadData()
  })

  const loadData = async () => {
    try {
      const [centerRes, couponRes] = await Promise.all([
        getMemberCenter(),
        getMemberCoupons({ status: 1 })
      ])
      if (centerRes.code === 200) {
        setData(centerRes.data)
        const recommend = centerRes.data.plans?.find((p: any) => p.is_recommend)
        if (recommend) {
          setSelectedPlanId(recommend.id)
        } else if (centerRes.data.plans?.length > 0) {
          setSelectedPlanId(centerRes.data.plans[0].id)
        }
      }
      if (couponRes.code === 200) {
        setCoupons(couponRes.data?.list || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleBuy = async () => {
    const token = Taro.getStorageSync('access_token')
    if (!token) {
      Taro.navigateTo({ url: '/pages/login/index?redirect=/pages/member/center/index' })
      return
    }
    const plan = data?.plans?.find((p: any) => p.is_recommend) || data?.plans?.[0]
    if (!plan) return
    Taro.navigateTo({ url: `/pages/member/info/index?planId=${plan.id}` })
  }

  const selectedPlan = data?.plans?.find((p: any) => p.id === selectedPlanId)

  return (
    <View className='member-center-page'>
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='page-back' onClick={() => {
            Taro.switchTab({ url: '/pages/profile/index' })
          }}>
            <Text className='page-back-icon'>←</Text>
          </View>
          <Text className='navbar-title'>会员中心</Text>
        </View>
      </View>

      {data?.is_member ? (
        /* ========== 已开通会员 —— 金色卡片样式 ========== */
        <>
          <View className='member-vip-card'>
            <Text className='member-vip-badge'>生效中</Text>
            <View className='member-vip-main'>
              <View className='member-vip-left'>
                <Text className='member-vip-title'>尾巴旅行会员</Text>
                <Text className='member-vip-price'>实付：¥39.90</Text>
                <Text className='member-vip-time'>购买时间：{data.member_info?.start_date?.split('T')[0] || '-'}</Text>
              </View>
              <View className='member-vip-right'>
                <Text className='member-vip-icon'>VIP</Text>
              </View>
            </View>
          </View>

          <View className='section benefit-section'>
            <Text className='section-title'>会员权益</Text>
            <View className='benefit-grid'>
              {data.member_info?.benefits?.map((b: any, idx: number) => (
                <View key={idx} className='benefit-item'>
                  <Text className='benefit-icon'>🎁</Text>
                  <Text className='benefit-title'>{b.title}</Text>
                </View>
              )) || <Text className='benefit-empty'>暂无权益</Text>}
            </View>
          </View>

          <View className='section'>
            <View className='section-header-row'>
              <Text className='section-title'>我的消费券</Text>
              <Text className='section-more' onClick={() => Taro.navigateTo({ url: '/pages/member/coupons/index' })}>
                全部 {'>'}
              </Text>
            </View>
            {coupons.length === 0 ? (
              <View className='coupon-preview'>
                <Text className='coupon-preview-text'>暂无会员专享消费券</Text>
              </View>
            ) : (
              <View className='coupon-list'>
                {coupons.slice(0, 5).map((item: any) => (
                  <View key={item.id} className='coupon-card'>
                    <View className='coupon-left'>
                      <Text className='coupon-value'>¥{item.value}</Text>
                      <Text className='coupon-type'>{TYPE_MAP[item.type] || '优惠券'}</Text>
                    </View>
                    <View className='coupon-right'>
                      <Text className='coupon-name'>{item.name}</Text>
                      <Text className='coupon-desc'>
                        {item.min_amount > 0 ? `满${item.min_amount}元可用` : '无门槛'}
                      </Text>
                      <Text className='coupon-valid'>有效期至 {item.valid_end_time ? item.valid_end_time.split('T')[0] : '-'}</Text>
                      <Text className='coupon-tag'>不可退</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      ) : (
        /* ========== 未开通会员 ========== */
        <>
          <View className='member-card'>
            <Text className='member-card-title'>开通会员享专属权益</Text>
            <Text className='member-card-sub'>每月领券包 · 专属折扣 · 优先退改</Text>
          </View>

          <View className='section plan-section'>
            <Text className='section-title'>选择套餐</Text>
            <View className='plan-scroll-wrap'>
              {data?.plans?.map((plan: any) => (
                <View
                  key={plan.id}
                  className={`plan-card ${selectedPlanId === plan.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  {plan.tag && <Text className='plan-tag'>{plan.tag}</Text>}
                  <Text className='plan-name'>{plan.name}</Text>
                  <View className='plan-price-row'>
                    <Text className='plan-price'>¥{plan.sale_price}</Text>
                    {plan.original_price > plan.sale_price && (
                      <Text className='plan-original'>¥{plan.original_price}</Text>
                    )}
                  </View>
                  <Text className='plan-duration'>{plan.duration_days}天</Text>
                  <View className='plan-benefits'>
                    {plan.benefits?.slice(0, 3).map((b: any, i: number) => (
                      <Text key={i} className='plan-benefit'>✓ {b.title}</Text>
                    ))}
                  </View>
                  <View className='plan-check'>
                    <View className={`check-circle ${selectedPlanId === plan.id ? 'checked' : ''}`} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {selectedPlan && (
            <View className='bottom-bar'>
              <View className='bottom-price-wrap'>
                <Text className='bottom-price'>应付 ¥{selectedPlan.sale_price}</Text>
                {selectedPlan.coupon_package?.total_value > 0 && (
                  <Text className='bottom-sub'>赠¥{selectedPlan.coupon_package.total_value}券包</Text>
                )}
              </View>
              <View className={`bottom-submit ${loading ? 'disabled' : ''}`} onClick={handleBuy}>
                {loading ? '处理中...' : '立即开通'}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  )
}

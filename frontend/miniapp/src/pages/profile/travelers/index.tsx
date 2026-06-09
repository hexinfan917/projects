import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Button , Image } from '@tarojs/components'
import { getTravelers, deleteTraveler, safeNavigateBack } from '../../../utils/api'
import './index.scss'

/** 姓名脱敏 */
const maskName = (name: string): string => {
  if (!name) return '-'
  const len = name.length
  if (len === 1) return name
  if (len === 2) return name[0] + '*'
  // 3字及以上：保留首字和尾字，中间用**代替
  return name[0] + '*'.repeat(Math.min(len - 2, 2)) + name[len - 1]
}

/** 身份证脱敏 */
const maskIdCard = (idCard: string) => {
  if (!idCard || idCard.length < 8) return idCard
  return idCard.slice(0, 4) + '********' + idCard.slice(-4)
}

/** 手机号脱敏 */
const maskPhone = (phone: string) => {
  if (!phone || phone.length !== 11) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export default function Travelers() {
  const [list, setList] = useState<any[]>([])

  useEffect(() => {
    loadTravelers()
  }, [])

  useDidShow(() => {
    loadTravelers()
  })

  const loadTravelers = () => {
    getTravelers().then(res => setList(res.data || []))
  }

  const handleDelete = (id: number) => {
    Taro.showModal({
      title: '提示',
      content: '确定删除该出行人吗？',
      success: async (res) => {
        if (res.confirm) {
          await deleteTraveler(id)
          Taro.showToast({ title: '删除成功', icon: 'success' })
          loadTravelers()
        }
      }
    })
  }

  return (
    <View className='travelers-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
      {list.map(item => (
        <View key={item.id} className='traveler-card'>
          <View className='traveler-header'>
            <Text className='traveler-name'>{maskName(item.name)}</Text>
            <Text className='traveler-phone'>{maskPhone(item.phone)}</Text>
          </View>
          <Text className='traveler-idcard'>身份证: {maskIdCard(item.id_card)}</Text>
          <View className='traveler-actions'>
            <Text
              className='action-text'
              onClick={() => Taro.navigateTo({ url: `/pages/profile/traveler-edit/index?id=${item.id}` })}
            >编辑</Text>
            <Text className='action-text delete' onClick={() => handleDelete(item.id)}>删除</Text>
          </View>
        </View>
      ))}

      {list.length === 0 && <Text className='empty-tip'>暂无出行人</Text>}

      <View
        className='travelers-add-btn'
        onClick={() => Taro.navigateTo({ url: '/pages/profile/traveler-edit/index' })}
      >
        + 添加出行人
      </View>
    </View>
  )
}

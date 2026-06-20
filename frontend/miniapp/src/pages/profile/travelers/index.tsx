import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { getTravelers, deleteTraveler, safeNavigateBack } from '../../../utils/api'
import './index.scss'

const appLogo = require('../../../assets/see-throughlogo.png')

/** 姓名脱敏 */
const maskName = (name: string): string => {
  if (!name) return '-'
  const len = name.length
  if (len === 1) return name
  if (len === 2) return name[0] + '*'
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
    <View className='travelers-page' style={{ paddingTop: 'calc(100rpx + env(safe-area-inset-top))' }}>
      <View className='travelers-navbar' style={{ paddingTop: 'calc(100rpx + env(safe-area-inset-top))' }}>
        <View className='travelers-navbar-back' onClick={() => safeNavigateBack()}>
          <Image className='travelers-navbar-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='travelers-navbar-title'>常用出行人</Text>
      </View>

      {list.length === 0 && (
        <View className='travelers-empty'>
          <Image className='travelers-empty-logo' src={appLogo as string} mode='aspectFit' />
          <Text className='travelers-empty-title'>还没有常用出行人</Text>
          <Text className='travelers-empty-subtitle'>添加您的出行人信息，下单时可一键选择，预订更快捷</Text>
        </View>
      )}

      {list.length > 0 && (
        <View className='travelers-list'>
          {list.map(item => (
            <View key={item.id} className='traveler-card'>
              <View className='traveler-header'>
                <View className='traveler-name-wrap'>
                  <Text className='traveler-name'>{maskName(item.name)}</Text>
                  {item.is_default ? <Text className='traveler-default-tag'>默认</Text> : null}
                </View>
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
        </View>
      )}

      <View
        className='travelers-add-btn'
        onClick={() => Taro.navigateTo({ url: '/pages/profile/traveler-edit/index' })}
      >
        <Text className='travelers-add-icon'>+</Text>
        <Text className='travelers-add-text'>添加出行人</Text>
      </View>
    </View>
  )
}

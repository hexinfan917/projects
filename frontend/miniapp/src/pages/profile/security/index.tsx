import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button } from '@tarojs/components'
import './index.scss'

export default function Security() {
  const [phone, setPhone] = useState('')

  useEffect(() => {
    const info = Taro.getStorageSync('user_info')
    if (info?.phone) setPhone(info.phone)
  }, [])

  const handleChangePhone = () => {
    Taro.showToast({ title: '功能开发中', icon: 'none' })
  }

  const handleChangePassword = () => {
    Taro.showToast({ title: '功能开发中', icon: 'none' })
  }

  return (
    <View className='security-page'>
      <View className='info-section'>
        <View className='info-item'>
          <Text className='info-label'>当前手机号</Text>
          <Text className='info-value'>{phone || '未绑定'}</Text>
        </View>
        <View className='info-item' onClick={handleChangePhone}>
          <Text className='info-label'>更换手机号</Text>
          <Text className='info-arrow'>></Text>
        </View>
        <View className='info-item' onClick={handleChangePassword}>
          <Text className='info-label'>修改密码</Text>
          <Text className='info-arrow'>></Text>
        </View>
      </View>
      <View className='tip-section'>
        <Text className='tip-text'>提示：更换手机号需要验证原手机号，修改密码需要短信验证码。</Text>
      </View>
    </View>
  )
}

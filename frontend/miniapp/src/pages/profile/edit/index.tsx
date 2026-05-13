import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button, Image } from '@tarojs/components'
import { getUserProfile, updateUserProfile, uploadFile } from '../../../utils/api'
import './index.scss'

const BASE_URL = 'https://tailtravel.westilt.com'

function fullImageUrl(url?: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${BASE_URL}${url}`
}

const GENDER_OPTIONS = [
  { label: '男', value: 1 },
  { label: '女', value: 2 },
]

export default function ProfileEdit() {
  const [user, setUser] = useState<any>({ nickname: '', phone: '', city: '', gender: 1, avatar: '' })

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = () => {
    const info = Taro.getStorageSync('user_info')
    if (info) {
      const gender = info.gender === 1 || info.gender === 2 ? info.gender : 1
      setUser({ ...info, gender, avatar: fullImageUrl(info.avatar) })
    }
  }

  const handleChooseAvatar = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        try {
          const uploadRes: any = await uploadFile(tempFilePath)
          const data = JSON.parse(uploadRes.data)
          if (data.code === 200 && data.data?.url) {
            setUser({ ...user, avatar: fullImageUrl(data.data.url) })
          } else {
            Taro.showToast({ title: '上传失败', icon: 'none' })
          }
        } catch {
          Taro.showToast({ title: '上传失败', icon: 'none' })
        }
      }
    })
  }

  const handleSave = async () => {
    try {
      const res: any = await updateUserProfile({
        nickname: user.nickname,
        phone: user.phone,
        city: user.city,
        gender: Number(user.gender) || 1,
        avatar: user.avatar,
      })
      if (res.code === 200) {
        Taro.setStorageSync('user_info', res.data)
        Taro.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 1000)
      } else {
        Taro.showToast({ title: res.message || '保存失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  return (
    <View className='profile-edit' style={{ paddingTop: '200rpx' }}>
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='page-back' onClick={() => Taro.navigateBack()}>
            <Text className='page-back-icon'>←</Text>
          </View>
          <Text className='navbar-title'>完善个人信息</Text>
        </View>
      </View>
      <View className='form-section'>
        <View className='avatar-row' onClick={handleChooseAvatar}>
          <Text className='label'>头像</Text>
          <View className='avatar-wrap'>
            {user.avatar ? (
              <Image className='avatar-img' src={fullImageUrl(user.avatar)} mode='aspectFill' />
            ) : (
              <View className='avatar-placeholder'>点击上传</View>
            )}
            <Text className='arrow'>{'>'}</Text>
          </View>
        </View>
        <View className='input-row'>
          <Text className='label'>昵称</Text>
          <Input className='input' placeholder='请输入昵称' value={user.nickname || ''} onInput={(e) => setUser({ ...user, nickname: e.detail.value })} />
        </View>
        <View className='input-row'>
          <Text className='label'>性别</Text>
          <View className='gender-wrap'>
            {GENDER_OPTIONS.map(opt => (
              <View
                key={opt.value}
                className={`gender-option ${Number(user.gender) === opt.value ? 'active' : ''}`}
                onClick={() => setUser({ ...user, gender: opt.value })}
              >
                <Text className='gender-text'>{opt.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className='input-row'>
          <Text className='label'>手机号</Text>
          <Input className='input' type='number' placeholder='请输入手机号' value={user.phone || ''} onInput={(e) => setUser({ ...user, phone: e.detail.value })} />
        </View>
        <View className='input-row'>
          <Text className='label'>所在城市</Text>
          <Input className='input' placeholder='请输入城市' value={user.city || ''} onInput={(e) => setUser({ ...user, city: e.detail.value })} />
        </View>
      </View>
      <Button className='save-btn' onClick={handleSave}>确认提交</Button>
    </View>
  )
}

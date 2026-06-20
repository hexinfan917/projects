import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button, Image } from '@tarojs/components'
import { getUserProfile, updateUserProfile, uploadFile, compressImageUrl, safeNavigateBack } from '../../../utils/api'
import './index.scss'

function fullImageUrl(url?: string) {
  if (!url) return ''
  return compressImageUrl(url, 200)
}

const isValidPhone = (phone: string): boolean => /^1[3-9]\d{9}$/.test(phone)

const isValidIdCard = (idCard: string): boolean => {
  if (!idCard || idCard.length !== 18) return false
  if (!/^\d{17}[\dXx]$/.test(idCard)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i++) sum += parseInt(idCard[i], 10) * weights[i]
  return checkCodes[sum % 11] === idCard[17].toUpperCase()
}

const isValidName = (name: string): boolean => {
  if (!name || name.length < 2 || name.length > 20) return false
  return /^[\u4e00-\u9fa5a-zA-Z·•]+$/.test(name)
}

const GENDER_OPTIONS = [
  { label: '男', value: 1 },
  { label: '女', value: 2 },
]

export default function ProfileEdit() {
  const [user, setUser] = useState<any>({ nickname: '', phone: '', city: '', gender: 1, avatar: '', real_name: '', id_card: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = () => {
    const info = Taro.getStorageSync('user_info')
    if (info) {
      const gender = info.gender === 1 || info.gender === 2 ? info.gender : 1
      setUser({ ...info, gender, avatar: fullImageUrl(info.avatar) })
    } else {
      getUserProfile().then((res: any) => {
        if (res.data) {
          const gender = res.data.gender === 1 || res.data.gender === 2 ? res.data.gender : 1
          setUser({ ...res.data, gender, avatar: fullImageUrl(res.data.avatar) })
        }
      }).catch(() => {})
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
    if (!user.real_name?.trim()) {
      Taro.showToast({ title: '请输入真实姓名', icon: 'none' })
      return
    }
    if (!isValidName(user.real_name.trim())) {
      Taro.showToast({ title: '姓名仅限2-20位中文/英文/·', icon: 'none' })
      return
    }
    if (!user.phone?.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!isValidPhone(user.phone.trim())) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    if (!user.id_card?.trim()) {
      Taro.showToast({ title: '请输入身份证号', icon: 'none' })
      return
    }
    if (!isValidIdCard(user.id_card.trim())) {
      Taro.showToast({ title: '身份证号格式不正确', icon: 'none' })
      return
    }

    setIsSubmitting(true)
    try {
      const res: any = await updateUserProfile({
        nickname: user.nickname,
        phone: user.phone,
        city: user.city,
        gender: Number(user.gender) || 1,
        avatar: user.avatar,
        real_name: user.real_name,
        id_card: user.id_card,
      })
      if (res.code === 200) {
        Taro.setStorageSync('user_info', res.data)
        Taro.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => safeNavigateBack(), 1000)
      } else {
        Taro.showToast({ title: res.message || '保存失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setUser({ ...user, [field]: value })
  }

  return (
    <View className='profile-edit-page'>
      {/* 顶部导航栏 */}
      <View className='profile-edit-navbar'>
        <View className='navbar-back' onClick={() => safeNavigateBack()}>
          <Text className='navbar-back-icon'>‹</Text>
        </View>
        <Text className='navbar-title'>完善个人信息</Text>
        <View className='navbar-more'>
          <Text className='navbar-more-icon'>⋯</Text>
        </View>
      </View>

      <View className='profile-edit-content'>
        {/* 头像上传 */}
        <View className='avatar-section' onClick={handleChooseAvatar}>
          <View className='avatar-wrap'>
            {user.avatar ? (
              <Image className='avatar-img' src={fullImageUrl(user.avatar)} mode='aspectFill' />
            ) : (
              <View className='avatar-placeholder'>
                <Text className='avatar-placeholder-icon'>📷</Text>
              </View>
            )}
          </View>
          <View className='avatar-upload-tag'>
            <Text className='avatar-upload-text'>点击上传</Text>
          </View>
        </View>

        {/* 表单卡片 */}
        <View className='form-card'>
          <View className='form-item inset-divider'>
            <Text className='form-label'>昵称</Text>
            <Input
              className='form-input'
              type='text'
              placeholder='请输入昵称'
              value={user.nickname || ''}
              onInput={(e) => updateField('nickname', e.detail.value)}
            />
          </View>

          <View className='form-item'>
            <Text className='form-label'>性别</Text>
            <View className='gender-options'>
              {GENDER_OPTIONS.map(opt => (
                <View
                  key={opt.value}
                  className={`gender-option ${Number(user.gender) === opt.value ? 'gender-option-active' : ''}`}
                  onClick={() => updateField('gender', opt.value)}
                >
                  <Text className='gender-option-text'>{opt.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='form-item inset-divider'>
            <Text className='form-label'>手机号</Text>
            <Input
              className='form-input'
              type='number'
              placeholder='请输入手机号'
              value={user.phone || ''}
              onInput={(e) => updateField('phone', e.detail.value)}
            />
          </View>

          <View className='form-item inset-divider'>
            <Text className='form-label'>真实姓名 <Text className='required'>*</Text></Text>
            <Input
              className='form-input'
              type='text'
              placeholder='请输入真实姓名'
              value={user.real_name || ''}
              onInput={(e) => updateField('real_name', e.detail.value)}
            />
          </View>

          <View className='form-item inset-divider'>
            <Text className='form-label'>身份证号 <Text className='required'>*</Text></Text>
            <Input
              className='form-input'
              type='idcard'
              placeholder='请输入身份证号'
              value={user.id_card || ''}
              onInput={(e) => updateField('id_card', e.detail.value)}
            />
          </View>

          <View className='form-item'>
            <Text className='form-label'>所在城市</Text>
            <Input
              className='form-input'
              type='text'
              placeholder='请输入城市'
              value={user.city || ''}
              onInput={(e) => updateField('city', e.detail.value)}
            />
          </View>
        </View>

        {/* 提交按钮 */}
        <Button className='submit-btn' onClick={handleSave} loading={isSubmitting}>
          {isSubmitting ? '提交中...' : '确认提交'}
        </Button>
      </View>
    </View>
  )
}

import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button, Image, Picker } from '@tarojs/components'
import { getPet, getPets, createPet, updatePet, uploadFile, compressImageUrl, safeNavigateBack } from '../../../utils/api'
import './index.scss'

import { BASE_URL } from '../../../utils/api'

function fullImageUrl(url?: string) {
  if (!url) return ''
  if (url.startsWith('http')) return compressImageUrl(url, 200)
  return `${BASE_URL}${url}?w=200&q=75`
}

function calcAge(birthDate?: string) {
  if (!birthDate) return ''
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age > 0 ? String(age) : ''
}

function ageToBirthDate(age: string) {
  const a = Number(age)
  if (!a || a <= 0) return undefined
  const now = new Date()
  const year = now.getFullYear() - a
  const month = now.getMonth() + 1
  const day = now.getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isNumericAge(ageStr: string) {
  return /^\d+(\.\d+)?$/.test(ageStr.trim())
}

export default function PetEdit() {
  const [pet, setPet] = useState<any>({
    name: '',
    breed: '',
    age: '',
    gender: 1,
    weight: '',
    avatar: '',
    vaccine_date: '',
    vaccine_book: '',
    is_default: false
  })
  const [from, setFrom] = useState('')
  const [statusBarHeight, setStatusBarHeight] = useState(40)
  const [navHeight, setNavHeight] = useState(88)

  useEffect(() => {
    const sysInfo = Taro.getSystemInfoSync()
    const sbh = sysInfo.statusBarHeight || 40
    setStatusBarHeight(sbh)
    // 导航栏内容区固定 44px(88rpx) + 状态栏高度 + 底部留白 8rpx
    setNavHeight((sbh + 44 + 4) * 2)
  }, [])

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const { id, from: fromParam } = instance.router?.params || {}
    setFrom(fromParam || '')
    if (id) {
      getPet(Number(id)).then(res => {
        const data = res.data || {}
        const ageStr = data.age_str || calcAge(data.birth_date) || ''
        setPet({
          ...data,
          age: ageStr,
          gender: data.gender === undefined ? 1 : data.gender,
          is_default: !!data.is_default,
          vaccine_book: data.vaccine_book || ''
        })
      })
    }
  }, [])

  const onVaccineChange = (e: any) => {
    setPet({ ...pet, vaccine_date: e.detail.value })
  }

  const chooseAvatar = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const tempPath = res.tempFilePaths[0]
      Taro.showLoading({ title: '上传中...', mask: true })
      try {
        const uploadRes: any = await uploadFile(tempPath)
        const data = JSON.parse(uploadRes.data)
        if (data.code === 200 && data.data?.url) {
          const url = fullImageUrl(data.data.url)
          setPet({ ...pet, avatar: url })
        } else {
          const msg = data.message || '上传失败'
          console.error('上传头像失败，接口返回:', data)
          Taro.showToast({ title: msg, icon: 'none', duration: 3000 })
        }
      } catch (err: any) {
        console.error('上传头像失败:', err)
        Taro.showToast({ title: err?.errMsg || err?.message || '上传失败，请重试', icon: 'none', duration: 3000 })
      } finally {
        Taro.hideLoading()
      }
    } catch (err: any) {
      console.error('选择图片失败:', err)
      if (err?.errMsg && err.errMsg.indexOf('cancel') === -1) {
        Taro.showToast({ title: err?.errMsg || '选择图片失败', icon: 'none' })
      }
    }
  }

  const chooseVaccineBook = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const tempPath = res.tempFilePaths[0]
      Taro.showLoading({ title: '上传中...', mask: true })
      try {
        const uploadRes: any = await uploadFile(tempPath)
        const data = JSON.parse(uploadRes.data)
        if (data.code === 200 && data.data?.url) {
          const url = fullImageUrl(data.data.url)
          setPet({ ...pet, vaccine_book: url })
        } else {
          const msg = data.message || '上传失败'
          console.error('上传疫苗本失败，接口返回:', data)
          Taro.showToast({ title: msg, icon: 'none', duration: 3000 })
        }
      } catch (err: any) {
        console.error('上传疫苗本失败:', err)
        Taro.showToast({ title: err?.errMsg || err?.message || '上传失败，请重试', icon: 'none', duration: 3000 })
      } finally {
        Taro.hideLoading()
      }
    } catch (err: any) {
      console.error('选择图片失败:', err)
      if (err?.errMsg && err.errMsg.indexOf('cancel') === -1) {
        Taro.showToast({ title: err?.errMsg || '选择图片失败', icon: 'none' })
      }
    }
  }

  const handleSave = async () => {
    if (!pet.avatar) {
      Taro.showToast({ title: '宠物照片不可为空', icon: 'none' })
      return
    }
    if (!pet.name || pet.name.trim() === '') {
      Taro.showToast({ title: '昵称不可为空', icon: 'none' })
      return
    }
    if (!pet.age || pet.age.trim() === '') {
      Taro.showToast({ title: '年龄不可为空', icon: 'none' })
      return
    }
    if (pet.gender === undefined || pet.gender === null) {
      Taro.showToast({ title: '性别不可为空', icon: 'none' })
      return
    }
    if (!pet.vaccine_date) {
      Taro.showToast({ title: '最近接种时间不可为空', icon: 'none' })
      return
    }
    if (!pet.breed || pet.breed.trim() === '') {
      Taro.showToast({ title: '品种不可为空', icon: 'none' })
      return
    }

    const ageStr = pet.age.trim()
    let birthDate: string | undefined
    if (isNumericAge(ageStr)) {
      birthDate = ageToBirthDate(ageStr)
    }

    const payload: any = {
      name: pet.name,
      breed: pet.breed,
      birth_date: birthDate || undefined,
      age_str: ageStr,
      gender: pet.gender,
      weight: pet.weight ? Number(pet.weight) : undefined,
      is_default: pet.is_default ? 1 : 0,
      avatar: pet.avatar,
      vaccine_date: pet.vaccine_date,
      vaccine_book: pet.vaccine_book || undefined
    }
    try {
      if (pet.id) {
        await updatePet(pet.id, payload)
      } else {
        const petsRes = await getPets()
        const existingPets = petsRes.data || []
        const isDuplicate = existingPets.some((p: any) =>
          p.name === pet.name &&
          p.age_str === ageStr &&
          p.gender === pet.gender
        )
        if (isDuplicate) {
          Taro.showModal({
            title: '提示',
            content: '宠物信息已存在，不可重复添加',
            showCancel: false
          })
          return
        }
        const res: any = await createPet(payload)
        if (res?.code !== 200) {
          throw new Error(res?.message || '保存失败')
        }
        if (res?.data?.id) {
          Taro.setStorageSync('order_confirm_select_pet_id', res.data.id)
        }
      }
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        safeNavigateBack()
      }, 1000)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }

  const canSubmit = !!pet.avatar && !!pet.name && !!pet.age && pet.age.trim() !== '' && pet.gender !== undefined && pet.gender !== null && !!pet.vaccine_date && !!pet.breed && pet.breed.trim() !== ''

  return (
    <View className='pet-edit-page'>
      {/* 顶部导航 */}
      <View className='pet-edit-header' style={{ paddingTop: `${statusBarHeight}px`, height: `${navHeight}rpx` }}>
        <View className='header-back' onClick={() => safeNavigateBack()}>
          <View className='header-back-arrow' />
        </View>
        <Text className='header-title'>{pet.id ? '编辑宠物' : '添加宠物'}</Text>
        <View className='header-placeholder' />
      </View>

      {/* 白色卡片 */}
      <View className='pet-edit-card' style={{ marginTop: `${navHeight}rpx` }}>
        {/* 宠物头像上传 */}
        <View className='avatar-section'>
          <View className='avatar-upload-wrap' onClick={chooseAvatar}>
            {pet.avatar ? (
              <Image className='avatar-img' src={fullImageUrl(pet.avatar)} mode='aspectFill' />
            ) : (
              <View className='avatar-placeholder'>
                <View className='camera-icon' />
                <Text className='avatar-placeholder-text'>正面照片</Text>
              </View>
            )}
            <View className='avatar-plus-btn'>
              <Text className='avatar-plus-text'>+</Text>
            </View>
          </View>
          <Text className='form-label avatar-label'>宠物照片 <Text className='required'>*</Text></Text>
        </View>

        {/* 表单 */}
        <View className='pet-form'>
          {/* 昵称 */}
          <View className='form-item'>
            <Text className='form-label'>昵称 <Text className='required'>*</Text></Text>
            <Input
              className='form-input'
              placeholder='您的宠物名字'
              placeholderStyle='color: #b0b8c4;'
              value={pet.name}
              onInput={(e) => setPet({ ...pet, name: e.detail.value })}
            />
          </View>

          {/* 年龄 */}
          <View className='form-item'>
            <Text className='form-label'>年龄 <Text className='required'>*</Text></Text>
            <View className='input-with-suffix'>
              <Input
                className='form-input'
                type='text'
                placeholder='请输入年龄'
                placeholderStyle='color: #b0b8c4;'
                value={pet.age}
                onInput={(e) => setPet({ ...pet, age: e.detail.value })}
              />
              <Text className='input-suffix'>岁</Text>
            </View>
          </View>

          {/* 性别 */}
          <View className='form-item'>
            <Text className='form-label'>性别 <Text className='required'>*</Text></Text>
            <View className='gender-group'>
              <Text
                className={`gender-tag ${pet.gender === 1 ? 'active' : ''}`}
                onClick={() => setPet({ ...pet, gender: 1 })}
              >公</Text>
              <Text
                className={`gender-tag ${pet.gender === 0 ? 'active' : ''}`}
                onClick={() => setPet({ ...pet, gender: 0 })}
              >母</Text>
            </View>
          </View>

          {/* 疫苗时间 */}
          <View className='form-item'>
            <Text className='form-label'>最近接种时间 <Text className='required'>*</Text></Text>
            <Picker mode='date' value={pet.vaccine_date || ''} onChange={onVaccineChange}>
              <View className={`picker-box ${pet.vaccine_date ? '' : 'placeholder'}`}>
                <Text className='picker-text'>{pet.vaccine_date || '年/月/日'}</Text>
                <View className='calendar-icon' />
              </View>
            </Picker>
          </View>

          {/* 品种 */}
          <View className='form-item'>
            <Text className='form-label'>品种 <Text className='required'>*</Text></Text>
            <Input
              className='form-input'
              placeholder='例如：金毛'
              placeholderStyle='color: #b0b8c4;'
              value={pet.breed}
              onInput={(e) => setPet({ ...pet, breed: e.detail.value })}
            />
          </View>

          {/* 体重 */}
          <View className='form-item'>
            <Text className='form-label'>体重 (kg)</Text>
            <View className='input-with-suffix'>
              <Input
                className='form-input'
                type='digit'
                placeholder='请输入体重'
                placeholderStyle='color: #b0b8c4;'
                value={pet.weight}
                onInput={(e) => setPet({ ...pet, weight: e.detail.value })}
              />
              <Text className='input-suffix'>kg</Text>
            </View>
          </View>

          {/* 疫苗本 */}
          <View className='form-item'>
            <Text className='form-label'>疫苗接种记录</Text>
            <View className='vaccine-upload-wrap' onClick={chooseVaccineBook}>
              {pet.vaccine_book ? (
                <Image className='vaccine-img' src={fullImageUrl(pet.vaccine_book)} mode='aspectFill' />
              ) : (
                <View className='vaccine-placeholder'>
                  <View className='upload-doc-icon' />
                  <Text className='vaccine-placeholder-text'>添加照片</Text>
                </View>
              )}
            </View>
          </View>

          {/* 设为默认 */}
          <View className='default-pet-row' onClick={() => setPet({ ...pet, is_default: !pet.is_default })}>
            <View className={`custom-checkbox ${pet.is_default ? 'checked' : ''}`}>
              {pet.is_default && <View className='checkbox-checkmark' />}
            </View>
            <Text className='default-pet-label'>设为默认宠物</Text>
          </View>

          {/* 提示 */}
          <View className='insurance-tip'>
            <View className='tip-icon'>
              <Text className='tip-icon-i'>i</Text>
            </View>
            <Text className='insurance-tip-text'>
              请如实填写宠物信息并上传有效的疫苗本照片。以上信息将用于为您申请宠物出行保险，虚假信息可能导致理赔失败。
            </Text>
          </View>
        </View>
      </View>

      {/* 底部按钮 */}
      <View className='pet-edit-footer'>
        <Button
          className='save-btn active'
          onClick={handleSave}
        >
          确认并保存
        </Button>
      </View>
    </View>
  )
}

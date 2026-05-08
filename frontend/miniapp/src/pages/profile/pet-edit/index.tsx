import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button, Image, Picker } from '@tarojs/components'
import { getPet, getPets, createPet, updatePet } from '../../../utils/api'
import './index.scss'

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

export default function PetEdit() {
  const [pet, setPet] = useState<any>({
    name: '',
    breed: '',
    age: '',
    gender: 1,
    weight: '',
    avatar: '',
    vaccine_date: '',
    is_default: false
  })
  const [from, setFrom] = useState('')

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const { id, from: fromParam } = instance.router?.params || {}
    setFrom(fromParam || '')
    if (id) {
      getPet(Number(id)).then(res => {
        const data = res.data || {}
        const ageStr = calcAge(data.birth_date)
        setPet({
          ...data,
          age: ageStr,
          gender: data.gender === undefined ? 1 : data.gender,
          is_default: !!data.is_default
        })
      })
    }
  }, [])

  const onVaccineChange = (e: any) => {
    setPet({ ...pet, vaccine_date: e.detail.value })
  }

  const chooseAvatar = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        setPet({ ...pet, avatar: res.tempFilePaths[0] })
      }
    })
  }

  const handleSave = async () => {
    if (!pet.name) {
      Taro.showToast({ title: '请填写宠物昵称', icon: 'none' })
      return
    }
    if (!pet.age || Number(pet.age) <= 0 || !/^[1-9]\d*$/.test(String(pet.age))) {
      Taro.showToast({ title: '请填写正确的正整数年龄', icon: 'none' })
      return
    }
    if (pet.gender === undefined || pet.gender === null) {
      Taro.showToast({ title: '请选择宠物性别', icon: 'none' })
      return
    }
    const birthDate = ageToBirthDate(pet.age)
    const payload: any = {
      name: pet.name,
      breed: pet.breed || undefined,
      birth_date: birthDate,
      gender: pet.gender,
      weight: pet.weight ? Number(pet.weight) : undefined,
      is_default: pet.is_default ? 1 : 0,
      avatar: pet.avatar || undefined,
      vaccine_date: pet.vaccine_date || undefined
    }
    try {
      if (pet.id) {
        await updatePet(pet.id, payload)
      } else {
        // 重复校验：查询已有宠物列表
        const petsRes = await getPets()
        const existingPets = petsRes.data || []
        const isDuplicate = existingPets.some((p: any) =>
          p.name === pet.name &&
          p.birth_date === birthDate &&
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
        Taro.navigateBack()
      }, 1000)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }

  const canSubmit = !!pet.name && !!pet.age && /^[1-9]\d*$/.test(String(pet.age)) && pet.gender !== undefined && pet.gender !== null

  return (
    <View className='pet-edit-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='pet-edit-modal'>
        <Text className='modal-title'>{pet.id ? '编辑宠物' : '添加宠物'}</Text>

        {/* 图片上传 */}
        <View className='form-row'>
          <Text className='form-label'>宠物图片</Text>
          <View className='avatar-upload' onClick={chooseAvatar}>
            {pet.avatar ? (
              <Image className='avatar-img' src={pet.avatar} mode='aspectFill' />
            ) : (
              <Text className='avatar-placeholder'>+</Text>
            )}
          </View>
        </View>

        {/* 昵称 */}
        <View className='form-row'>
          <Text className='form-label'>昵称 <Text className='required'>*</Text></Text>
          <Input
            className='form-input'
            placeholder='请输入宠物昵称'
            value={pet.name}
            onInput={(e) => setPet({ ...pet, name: e.detail.value })}
          />
        </View>

        {/* 年龄 */}
        <View className='form-row'>
          <Text className='form-label'>年龄 <Text className='required'>*</Text></Text>
          <Input
            className='form-input'
            type='number'
            placeholder='请输入年龄（正整数）'
            value={pet.age}
            onInput={(e) => setPet({ ...pet, age: e.detail.value })}
          />
        </View>

        {/* 性别 */}
        <View className='form-row'>
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

        {/* 品种 */}
        <View className='form-row'>
          <Text className='form-label'>品种</Text>
          <Input
            className='form-input'
            placeholder='请输入宠物品种'
            value={pet.breed}
            onInput={(e) => setPet({ ...pet, breed: e.detail.value })}
          />
        </View>

        {/* 体重 */}
        <View className='form-row'>
          <Text className='form-label'>体重(kg)</Text>
          <Input
            className='form-input'
            type='digit'
            placeholder='请输入体重'
            value={pet.weight}
            onInput={(e) => setPet({ ...pet, weight: e.detail.value })}
          />
        </View>

        {/* 疫苗时间 */}
        <View className='form-row'>
          <Text className='form-label'>疫苗时间</Text>
          <Picker mode='date' value={pet.vaccine_date || ''} onChange={onVaccineChange}>
            <View className={`picker-value ${pet.vaccine_date ? '' : 'placeholder'}`}>
              {pet.vaccine_date || '请选择疫苗时间'}
            </View>
          </Picker>
        </View>

        {/* 默认宠物 */}
        <View className='form-row checkbox-row' onClick={() => setPet({ ...pet, is_default: !pet.is_default })}>
          <Text className={`check-box ${pet.is_default ? 'checked' : ''}`} />
          <Text className='checkbox-label'>设为默认宠物</Text>
        </View>

        <Button className={`modal-save-btn ${canSubmit ? 'active' : 'disabled'}`} onClick={canSubmit ? handleSave : undefined}>
          确定
        </Button>
      </View>
    </View>
  )
}

import Taro, { useLoad } from '@tarojs/taro'
import { View, Text, Input, Button, Image } from '@tarojs/components'
import { useState } from 'react'
import { uploadFile, getSimplePetList } from '@/utils/api'
import CustomNavBar from '@/components/CustomNavBar'
import './index.scss'

const defaultAvatar = '/assets/images/placeholder-avatar.png'

export default function DogPersonalityPetForm() {
  const [form, setForm] = useState({
    name: '',
    breed: '',
    age: '',
    gender: 1,
    weight: '',
    avatar: '',
  })
  const [pkInviterId, setPkInviterId] = useState<number | null>(null)

  useLoad((options) => {
    const id = options.pk_inviter_result_id ? Number(options.pk_inviter_result_id) : null
    if (id) {
      setPkInviterId(id)
      Taro.setStorageSync('dp_pk_inviter_id', id)
      Taro.setStorageSync('dp_pk_mode', true)
    }
  })

  const chooseAvatar = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const uploadRes: any = await uploadFile(res.tempFilePaths[0])
      const data = JSON.parse(uploadRes.data)
      if (data.code === 200 && data.data?.url) {
        setForm({ ...form, avatar: data.data.url })
      }
    } catch (err) {
      console.error('上传头像失败:', err)
    }
  }

  const handleStart = async () => {
    const name = form.name.trim()
    const breed = form.breed.trim()
    const age = form.age.trim()
    const weight = form.weight.trim()

    if (!name) {
      Taro.showToast({ title: '请输入宠物名字', icon: 'none' })
      return
    }
    if (!breed) {
      Taro.showToast({ title: '请输入品种', icon: 'none' })
      return
    }
    if (!age) {
      Taro.showToast({ title: '请输入年龄', icon: 'none' })
      return
    }
    if (!weight) {
      Taro.showToast({ title: '请输入体重', icon: 'none' })
      return
    }

    const tempPetInfo = {
      name,
      breed,
      age_str: age,
      gender: form.gender,
      weight: Number(weight),
      avatar: form.avatar,
    }

    // 检查是否已存在相同档案
    try {
      const res = await getSimplePetList()
      const list = res.data || []
      const duplicate = list.find((p: any) =>
        p.name?.trim() === name &&
        p.breed?.trim() === breed &&
        p.age_str?.trim() === age &&
        p.gender === form.gender
      )
      if (duplicate) {
        Taro.showModal({
          title: '提示',
          content: `已存在相同宠物档案「${duplicate.name}」，将使用已有档案继续测评`,
          showCancel: false,
          success: () => {
            Taro.setStorageSync('dp_preselect_pet_id', duplicate.id)
            Taro.removeStorageSync('dp_temp_pet_info')
            if (pkInviterId) {
              Taro.redirectTo({
                url: `/subpackage/dog-personality/test/index?pk_inviter_result_id=${pkInviterId}`,
              })
            } else {
              Taro.navigateBack()
            }
          },
        })
        return
      }
    } catch (err) {
      console.error('加载宠物列表失败:', err)
    }

    // 保存临时宠物信息并进入测评
    Taro.setStorageSync('dp_temp_pet_info', tempPetInfo)
    if (pkInviterId) {
      Taro.redirectTo({
        url: `/subpackage/dog-personality/test/index?pk_inviter_result_id=${pkInviterId}`,
      })
    } else {
      Taro.navigateBack()
    }
  }

  return (
    <View className='dp-pet-form-page'>
      <CustomNavBar title='添加宠物' backgroundColor='#f9fafb' />

      <View className='dp-avatar-section' onClick={chooseAvatar}>
        <View className='dp-avatar-wrap'>
          {form.avatar ? (
            <Image className='dp-avatar' src={form.avatar} mode='aspectFill' />
          ) : (
            <View className='dp-avatar-placeholder'>
              <Text className='dp-camera-icon'>📷</Text>
              <Text className='dp-avatar-placeholder-text'>正面照片</Text>
            </View>
          )}
          <View className='dp-avatar-badge'>
            <Text className='dp-avatar-badge-text'>+</Text>
          </View>
        </View>
        <Text className='dp-avatar-label'>宠物照片（可选）</Text>
      </View>

      <View className='dp-form-item'>
        <Text className='dp-form-label'>
          昵称 <Text className='dp-required'>*</Text>
        </Text>
        <View className='dp-input-wrap'>
          <Input
            className='dp-form-input'
            placeholder='您的宠物名字'
            value={form.name}
            onInput={(e) => setForm({ ...form, name: e.detail.value })}
          />
        </View>
      </View>

      <View className='dp-form-item'>
        <Text className='dp-form-label'>
          年龄 <Text className='dp-required'>*</Text>
        </Text>
        <View className='dp-input-wrap'>
          <Input
            className='dp-form-input'
            placeholder='请输入年龄'
            type='digit'
            value={form.age}
            onInput={(e) => setForm({ ...form, age: e.detail.value })}
          />
          <Text className='dp-form-unit'>岁</Text>
        </View>
      </View>

      <View className='dp-form-item'>
        <Text className='dp-form-label'>
          性别 <Text className='dp-required'>*</Text>
        </Text>
        <View className='dp-gender-group'>
          <View
            className={`dp-gender-item ${form.gender === 1 ? 'active' : ''}`}
            onClick={() => setForm({ ...form, gender: 1 })}
          >
            <Text>公</Text>
          </View>
          <View
            className={`dp-gender-item ${form.gender === 0 ? 'active' : ''}`}
            onClick={() => setForm({ ...form, gender: 0 })}
          >
            <Text>母</Text>
          </View>
        </View>
      </View>

      <View className='dp-form-item'>
        <Text className='dp-form-label'>
          品种 <Text className='dp-required'>*</Text>
        </Text>
        <View className='dp-input-wrap'>
          <Input
            className='dp-form-input'
            placeholder='例如：金毛'
            value={form.breed}
            onInput={(e) => setForm({ ...form, breed: e.detail.value })}
          />
        </View>
      </View>

      <View className='dp-form-item'>
        <Text className='dp-form-label'>
          体重 <Text className='dp-required'>*</Text>
        </Text>
        <View className='dp-input-wrap'>
          <Input
            className='dp-form-input'
            placeholder='请输入体重'
            type='digit'
            value={form.weight}
            onInput={(e) => setForm({ ...form, weight: e.detail.value })}
          />
          <Text className='dp-form-unit'>kg</Text>
        </View>
      </View>

      <View className='dp-form-tip'>
        <Text>测评结束后，这些信息会自动保存到宠物档案</Text>
      </View>

      <Button className='dp-start-btn' onClick={handleStart}>
        保存
      </Button>
    </View>
  )
}

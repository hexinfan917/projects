import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button } from '@tarojs/components'
import { getTravelers, createTraveler, updateTraveler } from '../../../utils/api'
import './index.scss'

export default function TravelerEdit() {
  const [form, setForm] = useState<any>({ name: '', phone: '', id_card: '', gender: 0, is_default: 0 })

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      getTravelers().then(res => {
        const found = (res.data || []).find((t: any) => String(t.id) === id)
        if (found) {
          setForm({
            name: found.name || '',
            phone: found.phone || '',
            id_card: found.id_card || '',
            gender: found.gender || 0,
            is_default: found.is_default || 0,
            id: found.id
          })
        }
      })
    }
  }, [])

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.id_card) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    try {
      if (form.id) {
        const res: any = await updateTraveler(form.id, form)
        if (res?.code !== 200) {
          throw new Error(res?.message || '保存失败')
        }
      } else {
        const res: any = await createTraveler(form)
        if (res?.code !== 200) {
          throw new Error(res?.message || '保存失败')
        }
        if (res?.data?.id) {
          Taro.setStorageSync('order_confirm_select_traveler_id', res.data.id)
        }
      }
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }

  return (
    <View className='traveler-edit' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='form-section'>
        <View className='input-row'>
          <Text className='label'>姓名</Text>
          <Input className='input' placeholder='请输入真实姓名' value={form.name} onInput={(e) => setForm({ ...form, name: e.detail.value })} />
        </View>
        <View className='input-row'>
          <Text className='label'>手机号</Text>
          <Input className='input' type='number' placeholder='请输入手机号' value={form.phone} onInput={(e) => setForm({ ...form, phone: e.detail.value })} />
        </View>
        <View className='input-row'>
          <Text className='label'>身份证号</Text>
          <Input className='input' placeholder='请输入身份证号' value={form.id_card} onInput={(e) => setForm({ ...form, id_card: e.detail.value })} />
        </View>
      </View>

      <View className='form-section'>
        <View className='checkbox-row' onClick={() => setForm({ ...form, is_default: form.is_default ? 0 : 1 })}>
          <View className={`check-box ${form.is_default ? 'checked' : ''}`} />
          <Text className='checkbox-label'>设为默认出行人</Text>
        </View>
      </View>

      <Button className='save-btn' onClick={handleSave}>保存</Button>
    </View>
  )
}

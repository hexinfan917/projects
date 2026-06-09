import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button , Image } from '@tarojs/components'
import { updateUserProfile, safeNavigateBack } from '../../../utils/api'
import './index.scss'

export default function MemberInfo() {
  const [form, setForm] = useState({ real_name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [planId, setPlanId] = useState('')

  useEffect(() => {
    const router = Taro.getCurrentInstance().router
    if (router?.params?.planId) {
      setPlanId(router.params.planId)
    }
    // 自动从本地缓存读取用户信息填充表单
    const userInfo = Taro.getStorageSync('user_info')
    if (userInfo) {
      setForm(prev => ({
        ...prev,
        real_name: userInfo.real_name || '',
        phone: userInfo.phone || ''
      }))
    }
  }, [])

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const isValidName = (name: string): boolean => {
    if (!name || name.length < 2 || name.length > 20) return false
    return /^[\u4e00-\u9fa5a-zA-Z·•]+$/.test(name)
  }

  const handleSubmit = async () => {
    const name = form.real_name.trim()
    const phone = form.phone.trim()
    if (!name) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!isValidName(name)) {
      Taro.showToast({ title: '姓名仅限2-20位中文/英文/·', icon: 'none' })
      return
    }
    if (!phone) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const profileRes = await updateUserProfile(form)
      if (profileRes.code !== 200) {
        Taro.showToast({ title: profileRes.message || '保存失败', icon: 'none' })
        setLoading(false)
        return
      }
      if (planId) {
        Taro.navigateTo({ url: `/pages/member/pay/index?planId=${planId}` })
      } else {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/member/center/index' })
        }, 1500)
      }
    } catch (e: any) {
      Taro.showToast({ title: e.message || '请求失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='member-info-page'>
      <View className='custom-navbar'>
        <View className='navbar-bg' />
        <View className='navbar-content'>
          <View className='page-back' onClick={() => {
            const pages = Taro.getCurrentPages()
            if (pages.length > 1) {
              safeNavigateBack()
            } else {
              Taro.redirectTo({ url: '/pages/member/center/index' })
            }
          }}>
            <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
          </View>
          <Text className='navbar-title'>完善个人信息</Text>
        </View>
      </View>

      <View className='info-header'>
        <Text className='info-welcome'>欢迎加入</Text>
        <Text className='info-brand'>尾巴PetWay VIP会员</Text>
        <Text className='info-tip'>完善个人真实信息，不错过生日惊喜</Text>
      </View>

      <View className='info-form'>
        <View className='form-item'>
          <Text className='form-label'>姓名</Text>
          <Input
            className='form-input'
            placeholder='请输入姓名'
            value={form.real_name}
            onInput={(e) => handleChange('real_name', e.detail.value)}
          />
        </View>
        <View className='form-item'>
          <Text className='form-label'>手机号</Text>
          <Input
            className='form-input'
            placeholder='请输入手机号'
            type='number'
            maxLength={11}
            value={form.phone}
            onInput={(e) => handleChange('phone', e.detail.value)}
          />
        </View>
      </View>

      <View className='info-submit-wrap'>
        <Button className={`info-submit ${loading ? 'disabled' : ''}`} onClick={handleSubmit}>
          {loading ? '保存中...' : '确认提交'}
        </Button>
      </View>
    </View>
  )
}

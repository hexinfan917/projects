import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Textarea, Picker, Checkbox } from '@tarojs/components'
import { getCharityActivityDetail, registerCharityActivity } from '../../../utils/api'
import './index.scss'

const PARTICIPANT_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  label: `${i + 1}人`,
  value: i + 1,
}))

export default function CharityEnroll() {
  const [activity, setActivity] = useState<any>(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    participant_count: 1,
    city: '',
    remark: '',
    emergency_name: '',
    emergency_phone: '',
    agree_disclaimer: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      loadActivity(Number(id))
    }
  }, [])

  const loadActivity = async (id: number) => {
    try {
      Taro.showLoading({ title: '加载中' })
      const res = await getCharityActivityDetail(id)
      if (res.code === 200 && res.data) {
        setActivity(res.data)
      } else {
        Taro.showToast({ title: res.message || '加载失败', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = '请输入姓名'
    if (!form.phone.trim()) {
      newErrors.phone = '请输入联系电话'
    } else if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) {
      newErrors.phone = '请输入正确的手机号'
    }
    if (activity?.require_city && !form.city.trim()) {
      newErrors.city = '请输入所在城市'
    }
    if (activity?.require_emergency) {
      if (!form.emergency_name.trim()) newErrors.emergency_name = '请输入紧急联系人姓名'
      if (!form.emergency_phone.trim()) {
        newErrors.emergency_phone = '请输入紧急联系人电话'
      } else if (!/^1[3-9]\d{9}$/.test(form.emergency_phone.trim())) {
        newErrors.emergency_phone = '请输入正确的手机号'
      }
    }
    if (activity?.disclaimer && !form.agree_disclaimer) {
      newErrors.agree_disclaimer = '请同意免责条款'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    if (submitting) return

    setSubmitting(true)
    try {
      const res = await registerCharityActivity(activity.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        participant_count: form.participant_count,
        city: form.city.trim() || undefined,
        remark: form.remark.trim() || undefined,
        emergency_name: form.emergency_name.trim() || undefined,
        emergency_phone: form.emergency_phone.trim() || undefined,
        agree_disclaimer: form.agree_disclaimer,
      })
      if (res.code === 200) {
        Taro.showToast({ title: '报名成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.message || '报名失败', icon: 'none' })
      }
    } catch (error: any) {
      Taro.showToast({ title: error.message || '报名失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!activity) return null

  return (
    <View className='charity-enroll-page'>
      <View className='status-bar-placeholder' />
      <View className='page-header'>
        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
        <Text className='page-title'>活动报名</Text>
      </View>

      <View className='activity-card'>
        <Text className='activity-title'>{activity.title}</Text>
        {activity.subtitle && <Text className='activity-subtitle'>{activity.subtitle}</Text>}
        <View className='activity-meta'>
          {activity.location && <Text className='meta-item'>📍 {activity.location}</Text>}
          {activity.start_date && <Text className='meta-item'>📅 {activity.start_date}</Text>}
        </View>
      </View>

      <View className='form-section'>
        <View className='form-title'>报名信息</View>

        <View className={`form-item ${errors.name ? 'error' : ''}`}>
          <Text className='form-label required'>姓名</Text>
          <Input
            className='form-input'
            placeholder='请输入您的姓名'
            value={form.name}
            onInput={(e) => updateField('name', e.detail.value)}
          />
          {errors.name && <Text className='error-text'>{errors.name}</Text>}
        </View>

        <View className={`form-item ${errors.phone ? 'error' : ''}`}>
          <Text className='form-label required'>联系电话</Text>
          <Input
            className='form-input'
            placeholder='请输入手机号码'
            type='number'
            maxlength={11}
            value={form.phone}
            onInput={(e) => updateField('phone', e.detail.value)}
          />
          {errors.phone && <Text className='error-text'>{errors.phone}</Text>}
        </View>

        <View className='form-item'>
          <Text className='form-label required'>参与人数</Text>
          <Picker
            mode='selector'
            range={PARTICIPANT_OPTIONS}
            rangeKey='label'
            value={form.participant_count - 1}
            onChange={(e) => updateField('participant_count', PARTICIPANT_OPTIONS[e.detail.value].value)}
          >
            <View className='form-picker'>
              <Text className={form.participant_count ? 'picker-value' : 'picker-placeholder'}>
                {form.participant_count}人
              </Text>
              <Text className='picker-arrow'>›</Text>
            </View>
          </Picker>
        </View>

        {(activity.require_city === 1) && (
          <View className={`form-item ${errors.city ? 'error' : ''}`}>
            <Text className='form-label required'>所在城市 / 区域</Text>
            <Input
              className='form-input'
              placeholder='请输入所在城市'
              value={form.city}
              onInput={(e) => updateField('city', e.detail.value)}
            />
            {errors.city && <Text className='error-text'>{errors.city}</Text>}
          </View>
        )}

        {!activity.require_city && (
          <View className='form-item'>
            <Text className='form-label'>所在城市 / 区域</Text>
            <Input
              className='form-input'
              placeholder='请输入所在城市（选填）'
              value={form.city}
              onInput={(e) => updateField('city', e.detail.value)}
            />
          </View>
        )}

        <View className='form-item'>
          <Text className='form-label'>备注</Text>
          <Textarea
            className='form-textarea'
            placeholder='特殊需求、是否需要帮助等（选填）'
            value={form.remark}
            onInput={(e) => updateField('remark', e.detail.value)}
            maxlength={200}
          />
        </View>

        {(activity.require_emergency === 1) && (
          <>
            <View className={`form-item ${errors.emergency_name ? 'error' : ''}`}>
              <Text className='form-label required'>紧急联系人姓名</Text>
              <Input
                className='form-input'
                placeholder='请输入紧急联系人姓名'
                value={form.emergency_name}
                onInput={(e) => updateField('emergency_name', e.detail.value)}
              />
              {errors.emergency_name && <Text className='error-text'>{errors.emergency_name}</Text>}
            </View>
            <View className={`form-item ${errors.emergency_phone ? 'error' : ''}`}>
              <Text className='form-label required'>紧急联系人电话</Text>
              <Input
                className='form-input'
                placeholder='请输入紧急联系人电话'
                type='number'
                maxlength={11}
                value={form.emergency_phone}
                onInput={(e) => updateField('emergency_phone', e.detail.value)}
              />
              {errors.emergency_phone && <Text className='error-text'>{errors.emergency_phone}</Text>}
            </View>
          </>
        )}

        {!activity.require_emergency && (
          <>
            <View className='form-item'>
              <Text className='form-label'>紧急联系人姓名</Text>
              <Input
                className='form-input'
                placeholder='请输入紧急联系人姓名（选填）'
                value={form.emergency_name}
                onInput={(e) => updateField('emergency_name', e.detail.value)}
              />
            </View>
            <View className='form-item'>
              <Text className='form-label'>紧急联系人电话</Text>
              <Input
                className='form-input'
                placeholder='请输入紧急联系人电话（选填）'
                type='number'
                maxlength={11}
                value={form.emergency_phone}
                onInput={(e) => updateField('emergency_phone', e.detail.value)}
              />
            </View>
          </>
        )}

        {activity.disclaimer && (
          <View className={`form-item disclaimer-item ${errors.agree_disclaimer ? 'error' : ''}`}>
            <Text className='form-label required'>免责条款</Text>
            <View className='disclaimer-box'>
              <Text className='disclaimer-text'>{activity.disclaimer}</Text>
            </View>
            <View className='checkbox-wrap' onClick={() => updateField('agree_disclaimer', !form.agree_disclaimer)}>
              <Checkbox
                className='form-checkbox'
                checked={form.agree_disclaimer}
              />
              <Text className='checkbox-label'>我已阅读并同意上述免责条款</Text>
            </View>
            {errors.agree_disclaimer && <Text className='error-text'>{errors.agree_disclaimer}</Text>}
          </View>
        )}
      </View>

      <View className='bottom-bar'>
        <View
          className={`submit-btn ${submitting ? 'disabled' : ''}`}
          onClick={handleSubmit}
        >
          {submitting ? '提交中...' : '确认报名'}
        </View>
      </View>
    </View>
  )
}

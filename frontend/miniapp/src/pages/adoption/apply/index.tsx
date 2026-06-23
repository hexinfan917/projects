import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Textarea, Button, ScrollView, Image } from '@tarojs/components'
import { submitAdoptionApplication, getAdoptionDogDetail, safeNavigateBack, IMAGE_BASE_URL } from '../../../utils/api'
import './index.scss'

const GENDER_OPTIONS = ['男', '女']
const HOUSING_OPTIONS = ['自有住房', '整租房', '合租房', '宿舍']

export default function AdoptionApply() {
  const [dogId, setDogId] = useState<number>(0)
  const [detail, setDetail] = useState<any>(null)
  const [form, setForm] = useState({
    name: '',
    gender: '',
    age: '',
    phone: '',
    city: '',
    housing: '',
    hasExperience: false,
    otherPets: '',
    reason: '',
    commitment: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const id = Taro.getCurrentInstance().router?.params?.id
    if (id) {
      setDogId(Number(id))
      loadDetail(Number(id))
    }
  }, [])

  const loadDetail = async (id: number) => {
    try {
      const res = await getAdoptionDogDetail(id)
      if (res.code === 200 && res.data) {
        setDetail(res.data)
      }
    } catch (error) {
      console.error('加载狗狗详情失败', error)
    }
  }

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const validate = () => {
    if (!form.name.trim()) return '请填写姓名'
    if (!form.gender) return '请选择性别'
    if (!form.age.trim()) return '请填写年龄'
    if (!form.phone.trim()) return '请填写联系电话'
    if (!form.city.trim()) return '请填写所在城市'
    if (!form.housing) return '请选择居住情况'
    if (!form.reason.trim()) return '请填写领养理由'
    if (!form.commitment) return '请勾选领养承诺'
    return ''
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      Taro.showToast({ title: err, icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const submitData = {
        name: form.name,
        gender: form.gender,
        age: form.age,
        phone: form.phone,
        city: form.city,
        housing: form.housing,
        experience: `${form.hasExperience ? '有养犬经历' : '无养犬经历'}；现有宠物：${form.otherPets || '无'}`,
        reason: form.reason,
      }
      const res = await submitAdoptionApplication(dogId, submitData)
      if (res.code === 200) {
        setSuccess(true)
      } else {
        Taro.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSuccessConfirm = () => {
    setSuccess(false)
    safeNavigateBack()
  }

  const handleBack = () => {
    safeNavigateBack()
  }

  if (!detail) return null

  const fullImage = detail.cover_image
    ? (detail.cover_image.startsWith('http') ? detail.cover_image + '?w=200&q=75' : `${IMAGE_BASE_URL}${detail.cover_image}?w=200&q=75`)
    : ''

  return (
    <View className='adoption-apply-page'>
      <View className='custom-navbar'>
        <View className='page-back' onClick={handleBack}>
          <Text className='page-back-icon'>‹</Text>
        </View>
        <Text className='navbar-title'>领养申请</Text>
        <View className='navbar-spacer' />
      </View>

      <ScrollView className='scroll-container' scrollY>
        {/* 狗狗摘要卡片 */}
        <View className='summary-card'>
          <Image className='summary-image' src={fullImage} mode='aspectFill' />
          <View className='summary-info'>
            <Text className='summary-name'>{detail.name}</Text>
            <Text className='summary-desc'>帮助他找到一个温暖的家</Text>
            <View className='summary-tags'>
              <Text className='summary-tag'>{detail.gender} · {detail.age}</Text>
              <Text className='summary-tag'>{detail.breed}</Text>
            </View>
          </View>
        </View>

        <View className='form-sections'>
          {/* 基本信息 */}
          <View className='form-section'>
            <View className='section-title'>
              <Text className='section-icon'>👤</Text>
              <Text className='section-text'>基本信息</Text>
            </View>
            <View className='form-group'>
              <View className='form-field'>
                <Text className='field-label'>真实姓名</Text>
                <Input
                  className='field-input'
                  placeholder='请输入您的姓名'
                  value={form.name}
                  onInput={(e) => handleChange('name', e.detail.value)}
                />
              </View>
              <View className='form-field'>
                <Text className='field-label'>性别</Text>
                <View className='radio-row'>
                  {GENDER_OPTIONS.map((item) => (
                    <View
                      key={item}
                      className={`radio-pill ${form.gender === item ? 'active' : ''}`}
                      onClick={() => handleChange('gender', item)}
                    >
                      <Text className='radio-dot' />
                      <Text className='radio-pill-text'>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className='form-field'>
                <Text className='field-label'>年龄</Text>
                <Input
                  className='field-input'
                  placeholder='例如：28'
                  type='number'
                  value={form.age}
                  onInput={(e) => handleChange('age', e.detail.value)}
                />
              </View>
              <View className='form-field'>
                <Text className='field-label'>联系电话</Text>
                <Input
                  className='field-input'
                  placeholder='请输入联系电话'
                  type='number'
                  value={form.phone}
                  onInput={(e) => handleChange('phone', e.detail.value)}
                />
              </View>
              <View className='form-field'>
                <Text className='field-label'>居住城市</Text>
                <Input
                  className='field-input'
                  placeholder='例如：上海市 静安区'
                  value={form.city}
                  onInput={(e) => handleChange('city', e.detail.value)}
                />
              </View>
            </View>
          </View>

          {/* 居住环境 */}
          <View className='form-section'>
            <View className='section-title'>
              <Text className='section-icon'>🏠</Text>
              <Text className='section-text'>居住环境</Text>
            </View>
            <View className='form-group'>
              <View className='form-field'>
                <Text className='field-label'>居住情况</Text>
                <View className='radio-group housing-options'>
                  {HOUSING_OPTIONS.map((item) => (
                    <View
                      key={item}
                      className={`radio-card ${form.housing === item ? 'active' : ''}`}
                      onClick={() => handleChange('housing', item)}
                    >
                      <Text className='radio-text'>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* 养宠经验 */}
          <View className='form-section'>
            <View className='section-title'>
              <Text className='section-icon'>🐾</Text>
              <Text className='section-text'>养宠经验</Text>
            </View>
            <View className='form-group'>
              <View className='form-field'>
                <Text className='field-label'>过往是否有养犬经历？</Text>
                <View className='radio-row'>
                  <View
                    className={`radio-pill ${form.hasExperience ? 'active' : ''}`}
                    onClick={() => handleChange('hasExperience', true)}
                  >
                    <Text className='radio-dot' />
                    <Text className='radio-pill-text'>丰富经验</Text>
                  </View>
                  <View
                    className={`radio-pill ${!form.hasExperience ? 'active' : ''}`}
                    onClick={() => handleChange('hasExperience', false)}
                  >
                    <Text className='radio-dot' />
                    <Text className='radio-pill-text'>新手/第一次</Text>
                  </View>
                </View>
              </View>
              <View className='form-field'>
                <Text className='field-label'>目前家中的其他宠物</Text>
                <Input
                  className='field-input'
                  placeholder='例如：一只3岁的金毛，两只猫'
                  value={form.otherPets}
                  onInput={(e) => handleChange('otherPets', e.detail.value)}
                />
              </View>
            </View>
          </View>

          {/* 领养承诺 */}
          <View className='form-section'>
            <View className='section-title'>
              <Text className='section-icon'>🛡</Text>
              <Text className='section-text'>领养承诺</Text>
            </View>
            <View className='form-group'>
              <View className={`commitment-card ${form.commitment ? 'active' : ''}`} onClick={() => handleChange('commitment', !form.commitment)}>
                <View className={`commitment-check ${form.commitment ? 'active' : ''}`}>
                  <Text className='commitment-check-icon'>✓</Text>
                </View>
                <Text className='commitment-text'>
                  我承诺定期为{detail.name}接种疫苗、进行体内外驱虫，并提供科学的饮食和运动。
                </Text>
              </View>
              <View className='form-field'>
                <Text className='field-label'>为什么想领养{detail.name}？</Text>
                <Textarea
                  className='field-textarea'
                  placeholder={`请分享您想领养${detail.name}的原因，以及您对他的未来规划...`}
                  value={form.reason}
                  onInput={(e) => handleChange('reason', e.detail.value)}
                />
              </View>
            </View>
          </View>
        </View>

        <View className='safe-bottom-space' />
      </ScrollView>

      {/* 底部提交栏 */}
      <View className='bottom-bar'>
        <Button className={`submit-btn ${submitting ? 'disabled' : ''}`} disabled={submitting} onClick={handleSubmit}>
          <Text className='submit-text'>{submitting ? '提交中...' : '提交申请'}</Text>
          <Text className='submit-icon'>▶</Text>
        </Button>
        <Text className='submit-tip'>提交即代表您同意我们的《领养服务协议》</Text>
      </View>

      {/* 成功弹窗 */}
      {success && (
        <View className='success-overlay'>
          <View className='success-modal'>
            <View className='success-icon-wrap'>
              <Text className='success-icon'>✓</Text>
            </View>
            <Text className='success-title'>申请已提交</Text>
            <Text className='success-desc'>我们的志愿者将在3个工作日内与您联系，请保持电话畅通。</Text>
            <View className='success-btn' onClick={handleSuccessConfirm}>
              <Text className='success-btn-text'>返回首页</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

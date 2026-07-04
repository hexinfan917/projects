import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button, Checkbox, Image, Input } from '@tarojs/components'
import { login, getAgreements, updateUserProfile, uploadFile, safeNavigateBack } from '../../utils/api'
import './index.scss'

import { IMAGE_BASE_URL } from '../../utils/api'

function fullImageUrl(url?: string) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${IMAGE_BASE_URL}${url}`
}

export default function Login() {
  const [agreed, setAgreed] = useState(false)
  const [agreements, setAgreements] = useState<any[]>([])
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFilePath, setAvatarFilePath] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusBarHeight, setStatusBarHeight] = useState(40)

  useEffect(() => {
    const sys = Taro.getSystemInfoSync()
    setStatusBarHeight((sys.statusBarHeight || 20) * 2)
    loadAgreements()
    
    // 监听隐私授权需求（基础库 2.32.3+）
    if ((Taro as any).onNeedPrivacyAuthorization) {
      (Taro as any).onNeedPrivacyAuthorization((resolve: any, reject: any) => {
        console.log('[Privacy] onNeedPrivacyAuthorization triggered')
        // 微信会自动弹出官方隐私弹窗，这里不需要额外处理
        // 如果需要在弹窗前做自定义操作，可以在这里实现
      })
    }
  }, [])

  const loadAgreements = async () => {
    try {
      const res = await getAgreements()
      if (res.code === 200) {
        const list = res.data?.list || []
        setAgreements(list)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const goAgreementDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/agreements/detail/index?id=${id}` })
  }

  const goStaticTerms = () => {
    Taro.navigateTo({ url: '/pages/profile/terms/index' })
  }

  const goStaticPrivacy = () => {
    Taro.navigateTo({ url: '/pages/profile/privacy/index' })
  }

  const getAgreementIdByKeyword = (keyword: string) => {
    const found = agreements.find((a: any) => a.title?.includes(keyword))
    return found?.id
  }

  const getAgreementIdByKeywords = (...keywords: string[]) => {
    const found = agreements.find((a: any) => keywords.some(k => a.title?.includes(k)))
    return found?.id
  }

  const handleUserAgreementClick = () => {
    const id = getAgreementIdByKeyword('用户协议')
    if (id) goAgreementDetail(id)
    else goStaticTerms()
  }

  const handlePrivacyClick = () => {
    const id = getAgreementIdByKeywords('隐私政策', '隐私协议')
    if (id) goAgreementDetail(id)
    else goStaticPrivacy()
  }

  const doLoginSuccess = (data: any) => {
    const token = data?.data?.access_token
    if (token) {
      Taro.setStorageSync('access_token', token)
      Taro.setStorageSync('user_info', data.data.user)
      const savedToken = Taro.getStorageSync('access_token')
      console.log('[Login] token saved, preparing redirect... savedToken=', savedToken ? 'exists' : 'missing', 'length=', savedToken?.length)

      const isNewUser = data?.data?.is_new_user === true

      Taro.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 800,
        complete: () => {
          // 新用户引导完善资料（弹窗形式）
          if (isNewUser) {
            setShowProfileModal(true)
            return
          }

          // 检查是否有 redirect 参数
          const router = Taro.getCurrentInstance().router
          const redirect = router?.params?.redirect as string
          if (redirect) {
            Taro.navigateTo({ url: redirect })
            return
          }
          const pages = Taro.getCurrentPages()
          if (pages.length > 1) {
            safeNavigateBack()
          } else {
            Taro.setStorageSync('active_tab_index', 0)
            Taro.switchTab({ url: '/pages/index/index' })
          }
        }
      })
    } else {
      console.error('[Login] no access_token in response:', data)
      Taro.showToast({ title: data?.message || '登录异常，请检查后端', icon: 'none' })
    }
  }

  const handleGetPhoneNumber = async (e: any) => {
    console.log('[GetPhoneNumber] event:', e)
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
    // 用户拒绝授权手机号或隐私协议
    if (e.detail?.errMsg && e.detail.errMsg.includes('fail')) {
      console.log('[GetPhoneNumber] user denied:', e.detail?.errMsg)
      // 错误码112：隐私协议未声明
      if (e.detail.errno === 112) {
        Taro.showToast({ title: '隐私协议未声明手机号权限，请联系管理员', icon: 'none', duration: 3000 })
      } else if (e.detail.errno === 104) {
        Taro.showToast({ title: '请先同意隐私保护指引', icon: 'none', duration: 2000 })
      } else {
        Taro.showToast({ title: '需要绑定手机号才能登录', icon: 'none' })
      }
      return
    }

    const phoneCode = e.detail?.code
    console.log('[GetPhoneNumber] phoneCode:', phoneCode)
    if (!phoneCode) {
      Taro.showToast({ title: '获取手机号失败，请重试', icon: 'none' })
      return
    }

    try {
      const wxRes = await Taro.login()
      console.log('[GetPhoneNumber] wx.login code:', wxRes.code, 'phone_code:', phoneCode)
      const data = await login(wxRes.code, phoneCode)
      console.log('[GetPhoneNumber] login response:', data)
      doLoginSuccess(data)
    } catch (err) {
      console.error('[GetPhoneNumber] login error:', err)
      Taro.showToast({ title: '登录失败，请检查网络或后端服务', icon: 'none' })
    }
  }

  // --- 完善资料弹窗相关 ---
  const handleChooseAvatar = async (e: any) => {
    const tempFilePath = e.detail?.avatarUrl
    if (!tempFilePath) return
    setAvatarFilePath(tempFilePath)
    setAvatarUrl(tempFilePath)
    try {
      const uploadRes: any = await uploadFile(tempFilePath)
      const data = JSON.parse(uploadRes.data)
      if (data.code === 200 && data.data?.url) {
        setAvatarUrl(fullImageUrl(data.data.url))
        setAvatarFilePath('')
      }
    } catch (err) {
      console.error('头像上传失败:', err)
    }
  }

  const handleNicknameBlur = (e: any) => {
    const value = e.detail?.value
    if (value) setNickname(value)
  }

  const handleNicknameInput = (e: any) => {
    setNickname(e.detail?.value || '')
  }

  const goHome = () => {
    setShowProfileModal(false)
    Taro.setStorageSync('active_tab_index', 0)
    Taro.switchTab({ url: '/pages/index/index' })
  }

  const handleSubmitProfile = async () => {
    if (isSubmitting) return
    if (!nickname.trim() && !avatarUrl) {
      Taro.showModal({
        title: '提示',
        content: '您还没有填写昵称和头像，确定要跳过吗？',
        confirmText: '去填写',
        cancelText: '跳过',
        success: (res) => { if (res.cancel) goHome() }
      })
      return
    }
    setIsSubmitting(true)
    try {
      let finalAvatar = avatarUrl
      if (avatarFilePath && avatarFilePath.startsWith('wxfile://')) {
        const uploadRes: any = await uploadFile(avatarFilePath)
        const data = JSON.parse(uploadRes.data)
        if (data.code === 200 && data.data?.url) finalAvatar = fullImageUrl(data.data.url)
      }
      const res: any = await updateUserProfile({
        nickname: nickname.trim() || undefined,
        avatar: finalAvatar || undefined,
      })
      if (res.code === 200) {
        Taro.setStorageSync('user_info', res.data)
        Taro.showToast({ title: '设置成功', icon: 'success' })
        setTimeout(() => goHome(), 800)
      } else {
        Taro.showToast({ title: res.message || '保存失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkipProfile = () => {
    Taro.showModal({
      title: '提示',
      content: '跳过设置后，您可以在「我的-编辑资料」中随时修改昵称和头像',
      showCancel: true,
      confirmText: '去设置',
      cancelText: '跳过',
      success: (res) => { if (res.cancel) goHome() }
    })
  }
  // ------------------------

  return (
    <View className='login-page' style={{ paddingTop: `${statusBarHeight + 140}rpx` }}>

        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
      {/* 顶部导航栏 */}
      <View className='login-header-bar' style={{ paddingTop: `${statusBarHeight}rpx`, height: `${statusBarHeight + 88}rpx` }}>
        <View className='header-spacer' />
        <Text className='header-title'>Welcome</Text>
        <View className='header-spacer' />
      </View>

      {/* 品牌区域 */}
      <View className='brand-section'>
        <View className='logo-wrapper'>
          <View className='logo-glow' />
          <Image className='logo-img' src={require('../../assets/see-throughlogo.png')} mode='aspectFit' />
        </View>
        <View className='brand-text'>
          <Text className='brand-name'>PetWay</Text>
          <Text className='brand-subname'>尾巴PetWay</Text>
          <Text className='brand-slogan'>带着您的毛孩子，探索世界的每一个角落</Text>
        </View>
      </View>

      {/* 登录操作区域 */}
      <View className='action-section'>
        <View className='btn-wrapper'>
          <Button 
            className='wx-login-btn' 
            openType='getPhoneNumber|agreePrivacyAuthorization' 
            onGetPhoneNumber={handleGetPhoneNumber}
          >
            <Text className='btn-icon'>📱</Text>
            <Text className='btn-text'>手机号快捷登录</Text>
          </Button>
        </View>

      </View>

      {/* 隐私协议 */}
      <View className='agreement-row'>
        <Checkbox className='agreement-checkbox' checked={agreed} onClick={() => setAgreed(!agreed)} />
        <Text className='agreement-text'>
          我已阅读并同意
          <Text className='link' onClick={handleUserAgreementClick}>《用户协议》</Text>
          和
          <Text className='link' onClick={handlePrivacyClick}>《隐私政策》</Text>
          ，未注册手机号登录后将自动创建账号
        </Text>
      </View>

      {/* 背景装饰 */}
      <View className='bg-decoration bg-top-right' />
      <View className='bg-decoration bg-bottom-left' />

      {/* 完善资料弹窗 */}
      {showProfileModal && (
        <View className='profile-modal'>
          <View className='profile-modal-content'>
            <View className='pm-header'>
              <Image className='pm-logo' src={require('../../assets/see-throughlogo.png')} mode='aspectFit' />
              <Text className='pm-title'>欢迎来到尾巴PetWay</Text>
              <Text className='pm-subtitle'>设置您的专属昵称和头像</Text>
            </View>

            <View className='pm-form'>
              <View className='pm-avatar-wrap'>
                <Button className='pm-avatar-btn' openType='chooseAvatar' onChooseAvatar={handleChooseAvatar}>
                  {avatarUrl ? (
                    <Image className='pm-avatar-img' src={avatarUrl} mode='aspectFill' />
                  ) : (
                    <View className='pm-avatar-placeholder'>
                      <Text className='pm-avatar-icon'>📷</Text>
                      <Text className='pm-avatar-text'>点击设置头像</Text>
                    </View>
                  )}
                </Button>
              </View>

              <View className='pm-nickname-wrap'>
                <Text className='pm-label'>昵称</Text>
                <View className='pm-input-box'>
                  <Input
                    className='pm-input'
                    type='nickname'
                    placeholder='点击输入，或选择键盘上方「使用昵称」'
                    value={nickname}
                    onInput={handleNicknameInput}
                    onBlur={handleNicknameBlur}
                  />
                </View>
                <Text className='pm-tip'>点击输入框后，键盘上方会显示「使用昵称」</Text>
              </View>
            </View>

            <View className='pm-actions'>
              <Button className={`pm-submit-btn ${(!nickname.trim() && !avatarUrl) ? 'disabled' : ''}`} onClick={handleSubmitProfile}>
                {isSubmitting ? '保存中...' : '确认设置'}
              </Button>
              <Text className='pm-skip' onClick={handleSkipProfile}>稍后再说</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

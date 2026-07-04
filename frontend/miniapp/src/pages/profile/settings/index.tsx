import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { deleteAccount, getAgreements, getPublicSettings, safeNavigateBack } from '../../../utils/api'
import './index.scss'

const ICONS: Record<string, string> = {
  privacy: '/assets/icons/profile/privacy.svg',
  agreement: '/assets/icons/profile/agreement.svg',
  clear: '/assets/icons/profile/clear.svg',
  logout: '/assets/icons/profile/logout.svg',
}

export default function Settings() {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [agreements, setAgreements] = useState<any[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [appVersion, setAppVersion] = useState(Taro.getStorageSync('app_version') || '1.0.0')

  useEffect(() => {
    loadAgreements()
    loadAppVersion()
    const token = Taro.getStorageSync('access_token')
    setIsLoggedIn(!!token)
  }, [])

  const loadAppVersion = async () => {
    const cached = Taro.getStorageSync('app_version')
    if (cached) {
      setAppVersion(cached)
    }
    try {
      const res: any = await getPublicSettings()
      const version = res.data?.mp_version?.value
      if (version) {
        Taro.setStorageSync('app_version', version)
        setAppVersion(version)
      }
    } catch (e) {
      console.error('加载版本号失败:', e)
    }
  }

  const loadAgreements = async () => {
    try {
      const res = await getAgreements()
      if (res.code === 200) {
        setAgreements(res.data?.list || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const getAgreementIdByKeyword = (keyword: string) => {
    const found = agreements.find((a: any) => a.title?.includes(keyword))
    return found?.id
  }

  const getAgreementIdByKeywords = (...keywords: string[]) => {
    const found = agreements.find((a: any) => keywords.some(k => a.title?.includes(k)))
    return found?.id
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

  const handleClearCache = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要清除缓存吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorage()
          Taro.showToast({ title: '缓存已清除', icon: 'success' })
        }
      }
    })
  }

  const handleDeleteAccount = async () => {
    try {
      const res: any = await deleteAccount()
      if (res.code === 200) {
        Taro.clearStorage()
        Taro.showToast({ title: '账号已注销', icon: 'success' })
        setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 1500)
      } else {
        Taro.showToast({ title: res.message || '注销失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '注销失败', icon: 'none' })
    } finally {
      setShowDeleteModal(false)
    }
  }

  return (
    <View className='settings-page' style={{ paddingTop: 'calc(80rpx + env(safe-area-inset-top))' }}>
      <View className='settings-navbar' style={{ paddingTop: 'calc(80rpx + env(safe-area-inset-top))' }}>
        <View className='settings-navbar-back' onClick={() => safeNavigateBack()}>
          <Image className='settings-navbar-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='settings-navbar-title'>设置</Text>
      </View>

      <View className='settings-group'>
        <Text className='group-title'>其他设置</Text>
        <View className='settings-list'>
          <View className='settings-item' onClick={() => {
            const id = getAgreementIdByKeywords('隐私政策', '隐私协议')
            if (id) goAgreementDetail(id)
            else goStaticPrivacy()
          }}>
            <Image className='settings-item-icon' src={ICONS.privacy} mode='aspectFit' />
            <Text className='settings-label'>隐私政策</Text>
            <Text className='settings-arrow'>{'>'}</Text>
          </View>
          <View className='settings-item' onClick={() => {
            const id = getAgreementIdByKeyword('用户协议')
            if (id) goAgreementDetail(id)
            else goStaticTerms()
          }}>
            <Image className='settings-item-icon' src={ICONS.agreement} mode='aspectFit' />
            <Text className='settings-label'>用户协议</Text>
            <Text className='settings-arrow'>{'>'}</Text>
          </View>
          <View className='settings-item' onClick={handleClearCache}>
            <Image className='settings-item-icon' src={ICONS.clear} mode='aspectFit' />
            <Text className='settings-label'>清除缓存</Text>
            <Text className='settings-arrow'>{'>'}</Text>
          </View>
        </View>
      </View>

      {isLoggedIn && (
        <View className='settings-logout-card' onClick={() => setShowDeleteModal(true)}>
          <Image className='settings-logout-icon' src={ICONS.logout} mode='aspectFit' />
          <Text className='settings-logout-text'>注销账号</Text>
        </View>
      )}

      <View className='version-section'>
        <Text className='version-text'>VERSION {appVersion}</Text>
      </View>

      {showDeleteModal && (
        <View className='modal-overlay' onClick={() => setShowDeleteModal(false)}>
          <View className='modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='modal-title'>注销账号</Text>
            <Text className='tip-text'>注销后账号无法恢复，确定继续吗？</Text>
            <View className='submit-btn' style={{ background: '#EF4444' }} onClick={handleDeleteAccount}>
              <Text className='submit-btn-text'>确认注销</Text>
            </View>
            <View className='cancel-btn' onClick={() => setShowDeleteModal(false)}>
              <Text className='cancel-btn-text'>取消</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

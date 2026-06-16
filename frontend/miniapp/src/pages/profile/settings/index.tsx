import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { deleteAccount, getAgreements, safeNavigateBack } from '../../../utils/api'
import './index.scss'

export default function Settings() {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [agreements, setAgreements] = useState<any[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [statusBarHeight, setStatusBarHeight] = useState(40)

  useEffect(() => {
    loadAgreements()
    const token = Taro.getStorageSync('access_token')
    setIsLoggedIn(!!token)
    const sysInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(sysInfo.statusBarHeight || 40)
  }, [])

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

  const goAgreementDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/agreements/detail/index?id=${id}` })
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

  const navHeight = (statusBarHeight + 44 + 4) * 2

  return (
    <View className='settings-page' style={{ paddingTop: `${navHeight}rpx` }}>
      <View
        className='settings-header'
        style={{
          paddingTop: `${statusBarHeight}px`,
          height: `${navHeight}rpx`,
          boxSizing: 'border-box'
        }}
      >
        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='settings-title'>设置</Text>
        <View className='header-placeholder' />
      </View>

      <View className='settings-group'>
        <Text className='group-title'>其他设置</Text>
        <View className='settings-list'>
          <View className='settings-item' onClick={() => {
            const id = getAgreementIdByKeyword('隐私协议')
            if (id) goAgreementDetail(id)
            else Taro.showToast({ title: '暂无隐私协议', icon: 'none' })
          }}>
            <View className='item-left'>
              <Image className='item-icon' src='/assets/icons/icon-shield.svg' mode='aspectFit' />
              <Text className='settings-label'>隐私政策</Text>
            </View>
            <Text className='settings-arrow'>{'>'}</Text>
          </View>
          <View className='settings-item' onClick={() => {
            const id = getAgreementIdByKeyword('用户协议')
            if (id) goAgreementDetail(id)
            else Taro.showToast({ title: '暂无用户协议', icon: 'none' })
          }}>
            <View className='item-left'>
              <Image className='item-icon' src='/assets/icons/icon-file.svg' mode='aspectFit' />
              <Text className='settings-label'>用户协议</Text>
            </View>
            <Text className='settings-arrow'>{'>'}</Text>
          </View>
          <View className='settings-item' onClick={handleClearCache}>
            <View className='item-left'>
              <Image className='item-icon' src='/assets/icons/icon-mop.svg' mode='aspectFit' />
              <Text className='settings-label'>清除缓存</Text>
            </View>
            <Text className='settings-arrow'>{'>'}</Text>
          </View>
        </View>
      </View>

      {isLoggedIn && (
        <View className='settings-group logout-group'>
          <View className='settings-list'>
            <View className='settings-item logout-item' onClick={() => setShowDeleteModal(true)}>
              <Image className='logout-icon' src='/assets/icons/icon-logout.svg' mode='aspectFit' />
              <Text className='settings-label danger-text'>注销账号</Text>
            </View>
          </View>
        </View>
      )}

      <View className='version-section'>
        <Text className='version-text'>VERSION {Taro.getStorageSync('app_version') || '1.0.0'}</Text>
      </View>

      {showDeleteModal && (
        <View className='modal-overlay' onClick={() => setShowDeleteModal(false)}>
          <View className='modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='modal-title'>注销账号</Text>
            <Text className='tip-text'>注销后账号无法恢复，确定继续吗？</Text>
            <Button className='submit-btn' style={{ background: '#EF4444' }} onClick={handleDeleteAccount}>确认注销</Button>
            <Button className='cancel-btn' onClick={() => setShowDeleteModal(false)}>取消</Button>
          </View>
        </View>
      )}
    </View>
  )
}

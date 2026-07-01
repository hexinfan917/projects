import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button, Image } from '@tarojs/components'
import { updateUserProfile, uploadFile } from '../../../utils/api'
import './index.scss'

import { IMAGE_BASE_URL } from '../../../utils/api'

function fullImageUrl(url?: string) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${IMAGE_BASE_URL}${url}`
}

export default function CompleteInfo() {
  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFilePath, setAvatarFilePath] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // 加载当前用户信息（如果是从登录跳转过来的，可能已有随机昵称）
    const info = Taro.getStorageSync('user_info')
    if (info?.nickname && !info.nickname.startsWith('尾巴人_')) {
      setNickname(info.nickname)
    }
    if (info?.avatar) {
      setAvatarUrl(fullImageUrl(info.avatar))
    }
  }, [])

  const handleChooseAvatar = async (e: any) => {
    const tempFilePath = e.detail?.avatarUrl
    if (!tempFilePath) return

    setAvatarFilePath(tempFilePath)
    setAvatarUrl(tempFilePath)

    // 自动上传头像
    try {
      const uploadRes: any = await uploadFile(tempFilePath)
      const data = JSON.parse(uploadRes.data)
      if (data.code === 200 && data.data?.url) {
        setAvatarUrl(fullImageUrl(data.data.url))
        setAvatarFilePath('') // 已上传成功，清空临时路径
      }
    } catch (err) {
      console.error('头像上传失败:', err)
      // 临时文件路径保留，等提交时再试
    }
  }

  const handleNicknameBlur = (e: any) => {
    const value = e.detail?.value
    if (value) {
      setNickname(value)
    }
  }

  const handleNicknameInput = (e: any) => {
    setNickname(e.detail?.value || '')
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

    // 如果没有填写任何信息，提示一下
    if (!nickname.trim() && !avatarUrl) {
      Taro.showModal({
        title: '提示',
        content: '您还没有填写昵称和头像，确定要跳过吗？',
        confirmText: '去填写',
        cancelText: '跳过',
        success: (res) => {
          if (res.cancel) {
            goHome()
          }
        }
      })
      return
    }

    setIsSubmitting(true)

    try {
      let finalAvatar = avatarUrl

      // 如果头像还是临时文件路径，先上传
      if (avatarFilePath && avatarFilePath.startsWith('wxfile://')) {
        const uploadRes: any = await uploadFile(avatarFilePath)
        const data = JSON.parse(uploadRes.data)
        if (data.code === 200 && data.data?.url) {
          finalAvatar = fullImageUrl(data.data.url)
        }
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
      console.error('保存失败:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    Taro.showModal({
      title: '提示',
      content: '跳过设置后，您可以在「我的-编辑资料」中随时修改昵称和头像',
      showCancel: true,
      confirmText: '去设置',
      cancelText: '跳过',
      success: (res) => {
        if (res.cancel) {
          goHome()
        }
      }
    })
  }

  const goHome = () => {
    Taro.setStorageSync('active_tab_index', 0)
    Taro.switchTab({ url: '/pages/index/index' })
  }

  return (
    <View className='complete-info-page'>
      {/* 顶部背景 */}
      <View className='header-bg' />

      {/* 内容区 */}
      <View className='content-wrap'>
        <View className='brand-section'>
          <Image className='logo' src={require('../../../assets/see-throughlogo.png')} mode='aspectFit' />
          <Text className='title'>欢迎来到尾巴PetWay</Text>
          <Text className='subtitle'>设置您的专属昵称和头像，开启旅程</Text>
        </View>

        {/* 头像选择 */}
        <View className='form-card'>
          <View className='avatar-section'>
            <Button
              className='avatar-btn'
              openType='chooseAvatar'
              onChooseAvatar={handleChooseAvatar}
            >
              {avatarUrl ? (
                <View className='avatar-img-wrap'>
                  <Image className='avatar-img' src={avatarUrl} mode='aspectFill' />
                </View>
              ) : (
                <View className='avatar-placeholder'>
                  <Text className='placeholder-icon'>📷</Text>
                  <Text className='placeholder-text'>点击设置头像</Text>
                </View>
              )}
            </Button>
          </View>

          {/* 昵称输入 */}
          <View className='nickname-section'>
            <Text className='field-label'>昵称</Text>
            <View className='nickname-input-wrap'>
              <Input
                className='nickname-input'
                type='nickname'
                placeholder='请输入昵称，或点击键盘上方「使用昵称」'
                value={nickname}
                onInput={handleNicknameInput}
                onBlur={handleNicknameBlur}
              />
            </View>
            <Text className='field-tip'>点击输入框后，键盘上方会显示「使用昵称」快捷选项</Text>
          </View>
        </View>

        {/* 按钮区 */}
        <View className='btn-section'>
          <Button
            className={`submit-btn ${(!nickname.trim() && !avatarUrl) ? 'disabled' : ''}`}
            onClick={handleSubmit}
          >
            {isSubmitting ? '保存中...' : '确认设置'}
          </Button>
          <Text className='skip-text' onClick={handleSkip}>稍后再说</Text>
        </View>
      </View>
    </View>
  )
}

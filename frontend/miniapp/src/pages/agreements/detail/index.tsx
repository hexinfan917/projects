import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, RichText , Image } from '@tarojs/components'
import { getAgreementDetail, safeNavigateBack } from '../../../utils/api'
import './index.scss'

export default function AgreementDetail() {
  const router = useRouter()
  const [agreement, setAgreement] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = router.params.id
    if (id) {
      loadData(Number(id))
    }
  }, [router.params.id])

  const loadData = async (id: number) => {
    try {
      const res = await getAgreementDetail(id)
      if (res.code === 200) {
        setAgreement(res.data)
      } else {
        Taro.showToast({ title: res.message || '加载失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View className='agreement-detail-page'>
        <View className='custom-navbar'>
          <View className='page-back' onClick={() => safeNavigateBack()}>
            <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
          </View>
          <Text className='navbar-title'>协议详情</Text>
        </View>
        <View className='loading-state'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='agreement-detail-page'>
      <View className='custom-navbar'>
        <View className='page-back' onClick={() => safeNavigateBack()}>
          <Image className='page-back-icon' src='/assets/icons/return.png' mode='aspectFit' />
        </View>
        <Text className='navbar-title'>{agreement?.title || '协议详情'}</Text>
      </View>

      <View className='agreement-content'>
        {agreement?.content ? (
          <RichText nodes={agreement.content} />
        ) : (
          <Text className='empty-text'>暂无内容</Text>
        )}
      </View>
    </View>
  )
}

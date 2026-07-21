import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { useState } from 'react'
import { getDogPersonalityResultPublic, createDogPersonalityPkRecord } from '@/utils/api'
import CustomNavBar from '@/components/CustomNavBar'
import './index.scss'

const defaultAvatar = '/assets/images/placeholder-avatar.png'

const DIMENSION_META: Record<string, { label: string; left: string; right: string; color: string }> = {
  EI: { label: '社交倾向', left: 'E 外向', right: 'I 内向', color: '#1677ff' },
  SN: { label: '感知模式', left: 'S 实感', right: 'N 直觉', color: '#52c41a' },
  FT: { label: '情绪表达', left: 'F 感性', right: 'T 理性', color: '#faad14' },
  PJ: { label: '生活偏好', left: 'P 随性', right: 'J 计划', color: '#eb2f96' },
}

const DIMENSION_ORDER = ['EI', 'SN', 'FT', 'PJ']

const TYPE_CODE_COLORS: Record<string, string> = {
  ESFP: '#f59e0b', ESTP: '#f97316', ENFP: '#22c55e', ENTP: '#14b8a6',
  ESFJ: '#8b5cf6', ESTJ: '#6366f1', ENFJ: '#ec4899', ENTJ: '#0ea5e9',
  ISFP: '#f43f5e', ISTP: '#78716c', INFP: '#a855f7', INTP: '#3b82f6',
  ISFJ: '#10b981', ISTJ: '#64748b', INFJ: '#d946ef', INTJ: '#4f46e5',
}

function sumDimensionScores(dimensionScores?: Record<string, any>) {
  if (!dimensionScores) return 0
  return Object.values(dimensionScores).reduce((sum: number, ds: any) => sum + (ds.score || 0), 0)
}

function computeWinner(a: any, b: any) {
  const aTotal = sumDimensionScores(a.dimension_scores)
  const bTotal = sumDimensionScores(b.dimension_scores)
  if (aTotal > bTotal) return 'a'
  if (aTotal < bTotal) return 'b'
  return 'tie'
}

function buildDimensionComparison(aScores: Record<string, any>, bScores: Record<string, any>) {
  return DIMENSION_ORDER.map((dim) => {
    const a = aScores?.[dim] || { score: 0, max_score: 0, rate: 0 }
    const b = bScores?.[dim] || { score: 0, max_score: 0, rate: 0 }
    let winner = 'tie'
    if (a.score > b.score) winner = 'a'
    if (a.score < b.score) winner = 'b'
    return {
      dim,
      label: DIMENSION_META[dim].label,
      aScore: a.score,
      aRate: a.rate || 0,
      bScore: b.score,
      bRate: b.rate || 0,
      winner,
    }
  })
}

export default function DogPersonalityPkResult() {
  const [a, setA] = useState<any>(null)
  const [b, setB] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useShareAppMessage(() => {
    if (!a || !b) return {}
    const pkWinner = computeWinner(a, b)
    const winnerText =
      pkWinner === 'a'
        ? `${a.pet_name} 更胜一筹`
        : pkWinner === 'b'
        ? `${b.pet_name} 更胜一筹`
        : '势均力敌'
    return {
      title: `${a.pet_name} vs ${b.pet_name} 犬格 PK，${winnerText}！`,
      path: `/subpackage/dog-personality/pk/result/index?a=${a.id}&b=${b.id}`,
    }
  })

  useLoad(async (options) => {
    const aid = options.a ? Number(options.a) : null
    const bid = options.b ? Number(options.b) : null
    if (!aid || !bid) {
      setLoading(false)
      return
    }
    try {
      const [resA, resB] = await Promise.all([
        getDogPersonalityResultPublic(aid),
        getDogPersonalityResultPublic(bid),
      ])
      setA(resA.data)
      setB(resB.data)
      const token = Taro.getStorageSync('access_token')
      if (token && resA.data && resB.data) {
        const isOwnerA = !!resA.data.is_owner
        const isOwnerB = !!resB.data.is_owner
        if (resA.data.pet_id === resB.data.pet_id) {
          Taro.showToast({ title: '不能自己和自己 PK', icon: 'none' })
        } else if (isOwnerA && isOwnerB) {
          // 双方都是当前用户的宠物，等同同用户互相 PK
          Taro.showToast({ title: '不能用自己的宠物互相 PK', icon: 'none' })
        } else if (isOwnerA || isOwnerB) {
          // 仅当当前用户是 a 或 b 任一方主人时创建 PK 记录；非参与者只看不写
          try {
            await createDogPersonalityPkRecord(resA.data.id, resB.data.id)
          } catch (err) {
            console.error('记录 PK 失败:', err)
            Taro.showToast({ title: 'PK 记录保存失败', icon: 'none' })
          }
        }
      }
    } catch (err) {
      console.error('加载 PK 数据失败:', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  })

  if (loading) {
    return (
      <View className='dp-pk-result-page'>
        <CustomNavBar title='PK 结果' backgroundColor='#f9fafb' color='#1a4d2e' />
        <View className='dp-pk-result-loading'>
          <Text>PK 结果加载中...</Text>
        </View>
      </View>
    )
  }

  if (!a || !b) {
    return (
      <View className='dp-pk-result-page'>
        <CustomNavBar title='PK 结果' backgroundColor='#f9fafb' color='#1a4d2e' />
        <View className='dp-pk-result-loading'>
          <Text>PK 链接无效</Text>
        </View>
      </View>
    )
  }

  if (a.pet_id === b.pet_id) {
    return (
      <View className='dp-pk-result-page'>
        <CustomNavBar title='PK 结果' backgroundColor='#f9fafb' color='#1a4d2e' />
        <View className='dp-pk-result-loading'>
          <Text>不能自己和自己 PK 哦</Text>
        </View>
      </View>
    )
  }

  const winner = computeWinner(a, b)
  const aTotal = sumDimensionScores(a.dimension_scores)
  const bTotal = sumDimensionScores(b.dimension_scores)
  const scoreDiff = Math.abs(aTotal - bTotal)
  const funTag = winner === 'tie' ? '势均力敌' : scoreDiff >= 10 ? '碾压局' : '略胜一筹'

  const dimensions = buildDimensionComparison(a.dimension_scores, b.dimension_scores)
  const aColor = TYPE_CODE_COLORS[a.type_code] || '#16a34a'
  const bColor = TYPE_CODE_COLORS[b.type_code] || '#16a34a'

  return (
    <View className='dp-pk-result-page'>
      <CustomNavBar title='PK 结果' backgroundColor='#f9fafb' color='#1a4d2e' />

      <View className='dp-pk-result-hero'>
        <View className='dp-pk-result-tag'>{funTag}</View>
        <Text className='dp-pk-result-winner'>
          {winner === 'a' ? `${a.pet_name} 获胜` : winner === 'b' ? `${b.pet_name} 获胜` : '平局'}
        </Text>
        <Text className='dp-pk-result-sub'>
          {winner === 'tie' ? '两位毛孩子不相上下' : `以 ${scoreDiff} 分优势拿下本轮`}
        </Text>
      </View>

      <View className='dp-pk-result-vs'>
        <View className={`dp-pk-result-card ${winner === 'a' ? 'winner' : ''}`}>
          {winner === 'a' && <Text className='dp-pk-result-crown'>👑</Text>}
          <Image className='dp-pk-result-avatar' src={a.pet_avatar || defaultAvatar} mode='aspectFill' />
          <Text className='dp-pk-result-name'>{a.pet_name || '未命名'}</Text>
          <Text className='dp-pk-result-type-code' style={{ color: aColor }}>
            {a.type_code}
          </Text>
          <View className='dp-pk-result-type-title' style={{ background: aColor }}>
            <Text>{a.report_data?.title || a.title || '未知犬格'}</Text>
          </View>
          <Text className='dp-pk-result-total'>{aTotal} 分</Text>
        </View>

        <View className='dp-pk-result-vs-badge'>VS</View>

        <View className={`dp-pk-result-card ${winner === 'b' ? 'winner' : ''}`}>
          {winner === 'b' && <Text className='dp-pk-result-crown'>👑</Text>}
          <Image className='dp-pk-result-avatar' src={b.pet_avatar || defaultAvatar} mode='aspectFill' />
          <Text className='dp-pk-result-name'>{b.pet_name || '未命名'}</Text>
          <Text className='dp-pk-result-type-code' style={{ color: bColor }}>
            {b.type_code}
          </Text>
          <View className='dp-pk-result-type-title' style={{ background: bColor }}>
            <Text>{b.report_data?.title || b.title || '未知犬格'}</Text>
          </View>
          <Text className='dp-pk-result-total'>{bTotal} 分</Text>
        </View>
      </View>

      <View className='dp-pk-result-section'>
        <Text className='dp-pk-result-section-title'>四维得分对比</Text>
        <View className='dp-pk-module-list'>
          {dimensions.map((m, index) => (
            <View key={index} className='dp-pk-module-item'>
              <View className='dp-pk-module-row'>
                <Text className='dp-pk-module-score-text' style={{ color: aColor }}>
                  {m.aScore}
                </Text>
                <Text className='dp-pk-module-name'>{m.label}</Text>
                <Text className='dp-pk-module-score-text' style={{ color: bColor }}>
                  {m.bScore}
                </Text>
              </View>
              <View className='dp-pk-module-bars'>
                <View className='dp-pk-module-bar-left'>
                  <View
                    className='dp-pk-module-fill-left'
                    style={{ width: `${m.aRate * 100}%`, background: DIMENSION_META[m.dim].color }}
                  />
                </View>
                <View className='dp-pk-module-bar-right'>
                  <View
                    className='dp-pk-module-fill-right'
                    style={{ width: `${m.bRate * 100}%`, background: DIMENSION_META[m.dim].color }}
                  />
                </View>
              </View>
              <Text className='dp-pk-module-winner'>
                {m.winner === 'a'
                  ? `🏆 ${a.pet_name} 更胜一筹`
                  : m.winner === 'b'
                  ? `🏆 ${b.pet_name} 更胜一筹`
                  : '🤝 平局'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className='dp-pk-result-actions'>
        <Button
          className='dp-pk-result-btn'
          onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
        >
          返回首页
        </Button>
        <Text className='dp-pk-result-tip'>点击右上角可分享本次 PK 结果</Text>
      </View>
    </View>
  )
}

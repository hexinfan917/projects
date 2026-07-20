import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image, Button, Canvas } from '@tarojs/components'
import { useState, useRef, useEffect } from 'react'
import { getDogPersonalityResult } from '@/utils/api'
import CustomNavBar from '@/components/CustomNavBar'
import './index.scss'

const defaultAvatar = '/assets/images/placeholder-avatar.png'

const DIMENSION_META: Record<string, { label: string; en: string; left: string; right: string; color: string }> = {
  EI: { label: '社交倾向', en: 'Social', left: 'E 外向', right: 'I 内向', color: '#8b5000' },
  SN: { label: '感官敏感', en: 'Sensory', left: 'S 实感', right: 'N 直觉', color: '#0061a4' },
  FT: { label: '情感需求', en: 'Emotion', left: 'F 感性', right: 'T 理性', color: '#006e1c' },
  PJ: { label: '生活规律', en: 'Lifestyle', left: 'P 随性', right: 'J 计划', color: '#8b5000' },
}

const DIMENSION_INSIGHTS: Record<string, { high: string; midHigh: string; neutral: string; midLow: string; low: string }> = {
  EI: {
    high: '天生的社交明星，见了人和狗都想热情打招呼。',
    midHigh: '熟络后很放松，面对陌生环境会先观察一小会儿。',
    neutral: '社交看心情，有时热情似火，有时只想静静。',
    midLow: '更喜欢小圈子，陌生人和大场面会让它有点紧张。',
    low: '安静的陪伴型选手，只愿意对信任的人敞开心扉。',
  },
  SN: {
    high: '对环境变化比较淡定，专注当下，不容易被突发声响吓到。',
    midHigh: '多数情况沉着，遇到突然刺激会有正常警觉。',
    neutral: '胆大和谨慎模式随时切换，视具体场景而定。',
    midLow: '感官敏锐，容易对陌生声音、气味提高警惕。',
    low: '高敏感小雷达，细微变化都能注意到，需要温柔脱敏。',
  },
  FT: {
    high: '特别黏人，能敏锐读懂你的情绪，需要很多回应和陪伴。',
    midHigh: '喜欢亲近你，但也享受自己的独处时光。',
    neutral: '情感需求刚刚好，不冷淡也不过分依赖。',
    midLow: '比较独立，有自己的节奏，不太被你的情绪影响。',
    low: '性格稳重，能自己消化情绪，是省心的安静伙伴。',
  },
  PJ: {
    high: '随性自由派，讨厌被约束，灵活适应各种变化。',
    midHigh: '平时看心情，但熟悉的固定流程也能配合。',
    neutral: '既想要规律，也能接受生活中的小变化。',
    midLow: '喜欢可预期的生活，记得固定的喂食和散步时间。',
    low: '自律小管家，固定作息让它最有安全感。',
  },
}


const DIMENSION_ORDER = ['EI', 'SN', 'FT', 'PJ']

const GUIDE_ICONS = ['🏆', '🎯', '🤝', '🧩', '🏃', '🐕', '📚', '🌿']
const GUIDE_FALLBACK = [
  { icon: '💪', title: '每日耐力训练', desc: '建议每日进行不少于 45 分钟的中强度运动，高频率体能消耗能有效缓解过剩感官精力。', color: '#8b5000' },
  { icon: '🐕', title: '积极社交引导', desc: '多接触不同体型和性格的犬只锻炼适应力，良性社交能快速提升自信心。', color: '#0061a4' },
  { icon: '🔇', title: '特定脱敏控制', desc: '针对嘈杂环境进行安静等待训练，降低对外界突然响动或人流的过度应激。', color: '#006e1c' },
  { icon: '🧩', title: '感官互动游戏', desc: '配合益智玩具与嗅闻游戏，通过解决问题带来的成就感让心理更稳定成熟。', color: '#8b5000' },
]

function parseGuideText(text?: string): { icon: string; title: string; desc: string; color: string }[] {
  if (!text || !text.trim()) return GUIDE_FALLBACK
  const raw = text.trim()
  // 尝试按 ①②③④⑤⑥ 或 1. 2. 3. 或换行/分号拆分
  const numbered = raw.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/).filter(Boolean)
  if (numbered.length >= 2) {
    return numbered.slice(0, 8).map((item, idx) => {
      const clean = item.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').trim()
      const [title, ...descParts] = clean.split(/[，,；;。]/)
      return {
        icon: GUIDE_ICONS[idx % GUIDE_ICONS.length],
        title: title || '训练建议',
        desc: descParts.join('，') || clean,
        color: '#8b5000',
      }
    })
  }
  const dotted = raw.split(/\n+|(?:\d+[.．]\s+)/).filter((s) => s.trim().length > 3)
  if (dotted.length >= 2) {
    return dotted.slice(0, 8).map((item, idx) => {
      const clean = item.trim()
      const [title, ...descParts] = clean.split(/[，,；;。]/)
      return {
        icon: GUIDE_ICONS[idx % GUIDE_ICONS.length],
        title: title || '训练建议',
        desc: descParts.join('，') || clean,
        color: '#8b5000',
      }
    })
  }
  // 兜底：按句号或分号拆成最多 4 条
  const fallback = raw.split(/[。；;]/).filter((s) => s.trim().length > 3)
  if (fallback.length >= 2) {
    return fallback.slice(0, 4).map((item, idx) => ({
      icon: GUIDE_ICONS[idx % GUIDE_ICONS.length],
      title: '训练建议',
      desc: item.trim(),
      color: '#8b5000',
    }))
  }
  return [{ icon: GUIDE_ICONS[0], title: '训练建议', desc: raw, color: '#8b5000' }]
}


function getFirstSentence(text?: string) {
  if (!text) return '它是一只充满活力的小伙伴。'
  const idx = text.search(/[。！？.!?]/)
  return idx > 0 ? text.slice(0, idx + 1) : text.slice(0, 40)
}

function getDimensionInsight(dim: string, ds: any) {
  const positive = ds?.positive_score || 0
  const negative = ds?.negative_score || 0
  const positiveMax = ds?.positive_max || 1
  const negativeMax = ds?.negative_max || 1
  const positiveRate = positive / positiveMax
  const negativeRate = negative / negativeMax
  const diff = positiveRate - negativeRate

  const map = DIMENSION_INSIGHTS[dim]
  if (!map) return ''
  if (diff >= 0.5) return map.high
  if (diff >= 0.2) return map.midHigh
  if (diff > -0.2) return map.neutral
  if (diff > -0.5) return map.midLow
  return map.low
}

export default function DogPersonalityResult() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [animated, setAnimated] = useState(false)
  const [from, setFrom] = useState('')
  const [shareImagePath, setShareImagePath] = useState('')
  const shareModeRef = useRef<'report' | 'pk'>('report')

  useLoad(async (options) => {
    setFrom(options.from || '')
    // 报告已生成，清理测评计时
    Taro.removeStorageSync('dp_test_start_time')
    if (options.id) {
      await loadResult(Number(options.id))
    }
  })

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setAnimated(true), 100)
      generateShareImage(result)
      return () => clearTimeout(timer)
    }
  }, [result])

  // 用 canvas 绘制 5:4 分享卡片图（品牌底 + 宠物名 + 犬格编码），
  // 避免微信直接裁切宠物竖图导致封面显示不全
  const generateShareImage = async (res: any) => {
    try {
      const page: any = Taro.getCurrentInstance().page
      const ctx = Taro.createCanvasContext('dp-share-canvas', page)
      // 背景与顶部装饰条
      ctx.setFillStyle('#f7f3ea')
      ctx.fillRect(0, 0, 500, 400)
      ctx.setFillStyle('#1a4d2e')
      ctx.fillRect(0, 0, 500, 8)

      ctx.setTextAlign('center')
      // 宠物名：按名字长度自适应字号，过长截断
      let petName = (res.pet_name || '狗子').trim()
      if (petName.length > 8) petName = petName.slice(0, 8) + '…'
      const nameSize = petName.length <= 3 ? 64 : petName.length <= 5 ? 54 : 44
      ctx.setFillStyle('#1a4d2e')
      ctx.setFontSize(nameSize)
      ctx.fillText(petName, 250, 150)
      // 名字下方装饰短线
      ctx.setFillStyle('#d8cfbc')
      ctx.fillRect(210, 185, 80, 3)
      // 犬格编码与分型标题
      ctx.setFillStyle('#1a4d2e')
      ctx.setFontSize(44)
      ctx.fillText(res.type_code || '', 250, 260)
      ctx.setFillStyle('#8b5000')
      ctx.setFontSize(24)
      const levelTitle = res.report_data?.title || ''
      ctx.fillText(levelTitle ? `「${levelTitle}」` : '', 250, 312)
      // 底部品牌文案
      ctx.setFillStyle('#9a938a')
      ctx.setFontSize(18)
      ctx.fillText('尾巴旅行 · 犬格检测', 250, 365)

      ctx.draw(false, () => {
        setTimeout(() => {
          Taro.canvasToTempFilePath({
            canvasId: 'dp-share-canvas',
            destWidth: 500,
            destHeight: 400,
            success: (r) => setShareImagePath(r.tempFilePath),
            fail: (e) => console.error('分享图生成失败:', e)
          }, page)
        }, 100)
      })
    } catch (e) {
      console.error('生成分享图失败:', e)
    }
  }

  useShareAppMessage(() => {
    if (!result) return {}
    const title = result.report_data?.title || ''
    // 分享封面：canvas 绘制的 5:4 卡片图；未生成时微信回退为页面截图
    const shareImage = shareImagePath || ''
    if (shareModeRef.current === 'pk') {
      return {
        title: `我家 ${result.pet_name || '狗子'} 是「${result.type_code} · ${title}」，敢不敢让你家狗子来 PK？`,
        path: `/subpackage/dog-personality/pk/index/index?inviter_result_id=${result.id}`,
        imageUrl: shareImage,
      }
    }
    return {
      title: `我家 ${result.pet_name || '狗子'} 是「${result.type_code} · ${title}」，你家狗子是什么型？`,
      path: `/subpackage/dog-personality/result/index?id=${result.id}`,
      imageUrl: '',
    }
  })

  const loadResult = async (id: number) => {
    try {
      const res = await getDogPersonalityResult(id)
      setResult(res.data)
    } catch (err) {
      console.error('加载报告失败:', err)
      Taro.showToast({ title: '加载报告失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleRetest = () => {
    Taro.removeStorageSync('dp_test_draft')
    Taro.removeStorageSync('dp_temp_pet_info')
    Taro.removeStorageSync('dp_result_pending')
    Taro.removeStorageSync('dp_test_start_time')
    Taro.reLaunch({ url: '/subpackage/dog-personality/index/index' })
  }

  const handleInvitePk = () => {
    shareModeRef.current = 'pk'
  }

  const handleHistory = () => {
    Taro.navigateTo({ url: '/pages/profile/dog-personality-records/index' })
  }

  const handleCompleteProfile = () => {
    if (result?.pet_id) {
      Taro.navigateTo({ url: `/pages/profile/pet-edit/index?id=${result.pet_id}` })
    }
  }

  const getDimensionScore = (dim: string) => {
    const ds = result?.dimension_scores?.[dim]
    return ds || { score: 0, max_score: 0, rate: 0 }
  }

  if (loading) {
    return (
      <View className='dp-result-page'>
        <Text className='dp-loading'>报告生成中...</Text>
      </View>
    )
  }

  if (!result) {
    return (
      <View className='dp-result-page'>
        <Text className='dp-loading'>报告不存在</Text>
      </View>
    )
  }

  const report = result.report_data || {}
  const pkInviterId = Taro.getStorageSync('dp_pk_inviter_id')
  const showPkEntry = pkInviterId && pkInviterId !== result.id

  const handleGoPkResult = () => {
    Taro.removeStorageSync('dp_pk_inviter_id')
    Taro.removeStorageSync('dp_pk_mode')
    Taro.navigateTo({
      url: `/subpackage/dog-personality/pk/result/index?a=${pkInviterId}&b=${result.id}`,
    })
  }

  return (
    <View className='dp-result-page'>
      <CustomNavBar
        title='测评报告'
        backgroundColor='#fff8f5'
        onBack={() => {
          if (from === 'test') {
            Taro.switchTab({ url: '/pages/index/index' })
            return
          }
          const pages = Taro.getCurrentPages()
          if (pages.length > 1) {
            Taro.navigateBack()
          } else {
            Taro.switchTab({ url: '/pages/index/index' })
          }
        }}
      />

      {showPkEntry && (
        <View className='dp-pk-entry-banner' onClick={handleGoPkResult}>
          <Text className='dp-pk-entry-text'>测评完成！点击查看与好友的 PK 结果 ›</Text>
        </View>
      )}

      {result.reliability_score < 60 && (
        <View className='dp-reliability-tip'>
          <Text>结果可信度较低，建议根据狗狗真实表现重新测评</Text>
        </View>
      )}

      <View className='dp-hero-card'>
        <View className='dp-avatar-ring-outer' />
        <View className='dp-avatar-ring-inner' />
        <View className='dp-avatar-wrap'>
          <View className='dp-avatar-clip'>
            <Image className='dp-avatar' src={result.pet_avatar || defaultAvatar} mode='aspectFill' />
          </View>
          <View className='dp-avatar-badge'>
            <Text className='dp-avatar-badge-icon'>🏆</Text>
          </View>
        </View>

        <View className='dp-hero-name-row'>
          <Text className='dp-hero-name'>{result.pet_name || '未命名'}</Text>
          <View className='dp-hero-code-tag' style={{ background: '#8b5000' }}>
            <Text>{result.type_code}</Text>
          </View>
        </View>

        <View className='dp-hero-title'>
          <Text className='dp-hero-title-icon'>⚡</Text>
          <Text className='dp-hero-title-text'>{report.title || '未知犬格'}</Text>
        </View>

        {result.created_at && (
          <Text className='dp-hero-date'>测评日期：{String(result.created_at).slice(0, 10)}</Text>
        )}

      </View>

      <View className='dp-result-section'>
        <View className='dp-section-header'>
          <View className='dp-section-accent' style={{ background: '#8b5000' }} />
          <Text className='dp-section-title'>四维犬格解析</Text>
          <Text className='dp-section-subtitle'>维度得分：100%制</Text>
        </View>
        <View className='dp-dimension-list'>
          {DIMENSION_ORDER.map((dim, index) => {
            const ds = getDimensionScore(dim)
            const meta = DIMENSION_META[dim]
            const percent = Math.max(0, Math.min(100, Math.round((ds.rate || 0) * 100)))
            return (
              <View key={dim} className='dp-dimension-item'>
                <View className='dp-dimension-top'>
                  <View className='dp-dimension-labels'>
                    <Text className='dp-dimension-name'>{meta.label} ({meta.en})</Text>
                    <Text className='dp-dimension-poles'>{meta.left} | {meta.right}</Text>
                  </View>
                  <View className='dp-dimension-score'>
                    <Text className='dp-dimension-score-value' style={{ color: meta.color }}>
                      {ds.score}/{ds.max_score}
                    </Text>
                    <Text className='dp-dimension-score-unit'>Pts</Text>
                  </View>
                </View>
                <View className='dp-dimension-bar'>
                  <View
                    className='dp-dimension-fill'
                    style={{
                      width: animated ? `${percent}%` : '0%',
                      background: `linear-gradient(to right, ${meta.color}CC, ${meta.color})`,
                      transitionDelay: `${index * 100}ms`,
                    }}
                  >
                    <View className='dp-dimension-shimmer' />
                    <View className='dp-dimension-dot' />
                  </View>
                </View>
                <Text className='dp-dimension-insight'>{getDimensionInsight(dim, ds)}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className='dp-result-section'>
        <View className='dp-section-header'>
          <View className='dp-section-accent' style={{ background: '#0061a4' }} />
          <Text className='dp-section-title'>性格解读</Text>
        </View>
        <View className='dp-personality-header'>
          <Text className='dp-personality-title'>{report.title || '未知犬格'}</Text>
        </View>
        {report.key_behaviors && report.key_behaviors.length > 0 && (
          <View className='dp-key-behaviors'>
            <Text className='dp-key-behaviors-title'>行为画像</Text>
            <View className='dp-key-behaviors-list'>
              {report.key_behaviors.map((item: string, idx: number) => (
                <View key={idx} className='dp-key-behavior-item'>
                  <Text className='dp-key-behavior-dot'>•</Text>
                  <Text className='dp-key-behavior-text'>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <View className='dp-quote-block'>
          <Text className='dp-quote-mark'>“</Text>
          <Text className='dp-quote-text'>{getFirstSentence(report.description)}</Text>
        </View>
        <View className='dp-desc-body'>
          <Text className='dp-desc-text'>{report.description || '暂无解读'}</Text>
        </View>
      </View>

      <View className='dp-result-section'>
        <View className='dp-section-header dp-section-header-center'>
          <Text className='dp-section-title'>饲养 & 训练指南</Text>
          <Text className='dp-section-subtitle'>基于犬类行为分析模型</Text>
        </View>
        <View className='dp-guide-list'>
          {parseGuideText(report.guide).map((guide, index) => (
            <View key={index} className='dp-guide-card'>
              <View className='dp-guide-icon' style={{ color: guide.color || '#8b5000' }}>
                <Text>{guide.icon}</Text>
              </View>
              <View className='dp-guide-content'>
                <Text className='dp-guide-title'>{guide.title}</Text>
                <Text className='dp-guide-desc'>{guide.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {result.profile_status === 'incomplete' && (
        <View className='dp-complete-tip' onClick={handleCompleteProfile}>
          <Text>完善宠物档案，获取更精准推荐 &gt;</Text>
        </View>
      )}

      <View className='dp-footer-spacer' />

      {/* 隐藏的分享卡片画布（移出屏幕，仅用于生成 5:4 分享封面） */}
      <Canvas
        canvasId='dp-share-canvas'
        style={{ width: '500px', height: '400px', position: 'fixed', left: '-9999px', top: '-9999px' }}
      />

      <View className='dp-sticky-footer'>
        <View className='dp-footer-row'>
          <Button className='dp-footer-btn dp-footer-btn-secondary' openType='share' onClick={handleInvitePk}>
            <Text className='dp-footer-btn-icon'>🏆</Text>
            <Text>邀请PK</Text>
          </Button>
          <Button className='dp-footer-btn dp-footer-btn-secondary' onClick={handleHistory}>
            <Text className='dp-footer-btn-icon'>📋</Text>
            <Text>历史报告</Text>
          </Button>
        </View>
      </View>

    </View>
  )
}

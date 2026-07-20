import Taro, { useLoad } from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { getDogPersonalityQuestions } from '@/utils/api'
import CustomNavBar from '@/components/CustomNavBar'
import './index.scss'

interface Question {
  id: number
  question_order: number
  title: string
  options: { order: number; label: string; score: number }[]
  max_score: number
}

interface ModuleGroup {
  module_name: string
  module_order: number
  module_description?: string
  questions: Question[]
}

export default function DogPersonalityTest() {
  const [modules, setModules] = useState<ModuleGroup[]>([])
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, { order: number; score: number }>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useLoad(async (options) => {
    if (options.pk_inviter_result_id) {
      Taro.setStorageSync('dp_pk_inviter_id', Number(options.pk_inviter_result_id))
      Taro.setStorageSync('dp_pk_mode', true)
    }

    await loadQuestions()

    // 恢复草稿
    const draft = Taro.getStorageSync('dp_test_draft')
    if (draft) {
      setCurrentModuleIndex(draft.currentModuleIndex || 0)
      setAnswers(draft.answers || {})
    } else {
      // 新测评，记录开始时间
      Taro.setStorageSync('dp_test_start_time', Date.now())
    }
  })

  useEffect(() => {
    saveDraft()
  }, [currentModuleIndex, answers])

  useEffect(() => {
    if (!loading) {
      Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
    }
  }, [currentModuleIndex])

  const saveDraft = () => {
    if (Object.keys(answers).length > 0) {
      Taro.setStorageSync('dp_test_draft', {
        currentModuleIndex,
        answers,
        modules: modules.map((m) => ({
          module_name: m.module_name,
          questions: m.questions.map((q) => ({ id: q.id })),
        })),
        updateTime: Date.now(),
      })
    }
  }

  const loadQuestions = async () => {
    setLoadError(false)
    try {
      const res = await getDogPersonalityQuestions()
      const moduleList = res.data?.modules || []
      setModules(moduleList)
      if (moduleList.length === 0) {
        setLoadError(true)
      }
    } catch (err) {
      console.error('加载题目失败:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setLoading(true)
    loadQuestions()
  }

  const isQuestionUnlocked = (qIndex: number) => {
    if (qIndex === 0) return true
    const currentModule = modules[currentModuleIndex]
    if (!currentModule) return false
    for (let i = 0; i < qIndex; i++) {
      if (answers[currentModule.questions[i].id] === undefined) {
        return false
      }
    }
    return true
  }

  const handleSelect = (questionId: number, option: { order: number; score: number }) => {
    setAnswers({ ...answers, [questionId]: option })
  }

  const isModuleComplete = () => {
    const currentModule = modules[currentModuleIndex]
    if (!currentModule) return false
    return currentModule.questions.every((q) => answers[q.id] !== undefined)
  }

  const handleNext = () => {
    if (!isModuleComplete()) {
      Taro.showToast({ title: '请完成当前模块所有题目', icon: 'none' })
      return
    }

    if (currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1)
      return
    }

    goToPetConfirm()
  }

  const handlePrev = () => {
    if (currentModuleIndex > 0) {
      setCurrentModuleIndex(currentModuleIndex - 1)
    }
  }

  const goToPetConfirm = () => {
    Taro.setStorageSync('dp_test_draft', {
      currentModuleIndex: modules.length - 1,
      answers,
      modules: modules.map((m) => ({
        module_name: m.module_name,
        questions: m.questions.map((q) => ({ id: q.id })),
      })),
      updateTime: Date.now(),
    })
    Taro.setStorageSync('dp_result_pending', true)

    const token = Taro.getStorageSync('access_token')
    if (!token) {
      const pkInviterId = Taro.getStorageSync('dp_pk_inviter_id')
      const loginUrl = pkInviterId
        ? `/pages/login/index?redirect=${encodeURIComponent('/subpackage/dog-personality/pet-select/index')}`
        : '/pages/login/index?from=dp_test'
      Taro.showModal({
        title: '提示',
        content: '查看报告前请先登录',
        showCancel: false,
        success: () => {
          // 使用 navigateTo 保留测试页，登录页返回时能回到最后一题
          Taro.navigateTo({ url: loginUrl })
        },
      })
      return
    }

    Taro.navigateTo({ url: '/subpackage/dog-personality/pet-select/index' })
  }

  if (loading) {
    return (
      <View className='dp-test-page'>
        <Text className='dp-loading'>题目加载中...</Text>
      </View>
    )
  }

  // 加载失败或题目为空：展示错误提示与重试入口，避免渲染空 modules 导致白屏
  if (loadError || modules.length === 0) {
    return (
      <View className='dp-test-page'>
        <View className='dp-load-error'>
          <Text className='dp-load-error-text'>题目加载失败，请检查网络后重试</Text>
          <Button className='dp-load-error-btn' onClick={handleRetry}>重试</Button>
        </View>
      </View>
    )
  }

  const currentModule = modules[currentModuleIndex]
  const progress = ((currentModuleIndex + 1) / modules.length) * 100
  const moduleDesc = currentModule.module_description || ''

  return (
    <View className='dp-test-page'>
      <CustomNavBar title='犬格检测' backgroundColor='#fcf9f8' color='#1a4d2e' />

      <View className='dp-progress-section'>
        <View className='dp-progress-header'>
          <Text className='dp-progress-label'>模块 {currentModuleIndex + 1}/{modules.length}</Text>
          <Text className='dp-progress-percent'>{progress.toFixed(1)}%</Text>
        </View>
        <View className='dp-progress-track'>
          <View className='dp-progress-fill' style={{ width: `${progress}%` }} />
        </View>
      </View>

      <View className='dp-module-header'>
        <Text className='dp-module-title'>{currentModule.module_name}</Text>
        {moduleDesc && <Text className='dp-module-desc'>{moduleDesc}</Text>}
      </View>

      <View className='dp-question-list'>
        {currentModule.questions.map((question, qIndex) => {
          const unlocked = isQuestionUnlocked(qIndex)
          return (
            <View key={question.id} className={`dp-question-card ${unlocked ? '' : 'locked'}`}>
              <View className='dp-question-title'>
                <Text className='dp-question-num'>{String(qIndex + 1).padStart(2, '0')}</Text>
                <Text className='dp-question-text'>{question.title}</Text>
              </View>
              {unlocked ? (
                <View className='dp-options'>
                  {question.options.map((option) => (
                    <View
                      key={option.order}
                      className={`dp-option ${answers[question.id]?.order === option.order ? 'active' : ''}`}
                      onClick={() => handleSelect(question.id, option)}
                    >
                      <Text className='dp-option-text'>{option.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className='dp-locked-tip'>
                  <Text>请先完成上一题以解锁</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>

      <View className='dp-test-actions'>
        {currentModuleIndex > 0 ? (
          <Button className='dp-prev-btn' onClick={handlePrev}>上一模块</Button>
        ) : (
          <View className='dp-prev-placeholder' />
        )}
        <Button
          className={`dp-next-btn ${isModuleComplete() ? '' : 'disabled'}`}
          onClick={handleNext}
        >
          {currentModuleIndex === modules.length - 1 ? '查看报告' : '下一模块'}
        </Button>
      </View>
    </View>
  )
}

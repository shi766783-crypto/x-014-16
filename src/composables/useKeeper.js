import { computed, reactive, ref } from 'vue'
import { createStorage } from '../services/storage'
import { config, seed } from '../data'

const storage = createStorage(config.storageKey, seed)
const backupStorage = createStorage(`${config.storageKey}-backup`, null)
// 经过 JSON 序列化拷贝，避免直接 structuredClone 响应式 Proxy 的兼容问题
const clone = (value) => JSON.parse(JSON.stringify(value))

export function useKeeper() {
  const state = reactive(storage.read())
  const snapshot = ref(backupStorage.read())
  const persist = () => storage.write(state)
  const add = (collection, item) => { state[collection].unshift({ id: `${collection}-${Date.now()}`, createdAt: new Date().toISOString(), ...item }); persist() }
  const update = (collection, id, patch) => { const item = state[collection].find((entry) => entry.id === id); if (item) Object.assign(item, patch); persist() }
  const remove = (collection, id) => { state[collection] = state[collection].filter((entry) => entry.id !== id); persist() }
  // 整体替换：先删掉目标数据中不存在的键，再整体赋值，保证不出现部分恢复或新旧混杂
  const replaceAll = (next) => {
    Object.keys(state).forEach((key) => { if (!(key in next)) delete state[key] })
    Object.assign(state, clone(next))
    persist()
  }
  // 恢复演示数据前自动保留当前数据快照，供撤销使用
  const reset = () => {
    snapshot.value = { savedAt: new Date().toISOString(), data: clone(state) }
    backupStorage.write(snapshot.value)
    replaceAll(seed)
  }
  const undoReset = () => {
    if (!snapshot.value?.data) return false
    replaceAll(snapshot.value.data)
    snapshot.value = null
    backupStorage.clear()
    return true
  }
  const canUndo = computed(() => Boolean(snapshot.value?.data))
  const metrics = computed(() => config.metrics.map((metric) => ({ ...metric, value: metric.value ? metric.value(state) : state[metric.collection]?.length || 0 })))
  return { state, add, update, remove, reset, undoReset, canUndo, persist, metrics }
}

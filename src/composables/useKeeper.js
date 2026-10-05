import { computed, reactive, ref } from 'vue'
import { createStorage } from '../services/storage'
import { config, seed } from '../data'

const COLLECTIONS = ['documents', 'policies', 'usages']
// 数据均为可 JSON 序列化的录入内容（含图片 dataURL）；用 JSON 深拷贝可安全处理 Vue 响应式代理。
const clone = (value) => JSON.parse(JSON.stringify(value))
const storage = createStorage(config.storageKey, seed, config.snapshotKey)

function isComplete(value) {
  return value && COLLECTIONS.every((key) => Array.isArray(value[key]))
}
function replaceInto(state, next) {
  COLLECTIONS.forEach((key) => { state[key] = clone(next[key]) })
}

export function useKeeper() {
  const state = reactive(storage.read())
  const persist = () => storage.write(state)

  const savedSnapshot = ref(storage.readSnapshot())
  const snapshotAt = computed(() => savedSnapshot.value?.at || '')
  const snapshotCounts = computed(() => savedSnapshot.value?.counts || {})
  const notice = ref('')
  let noticeTimer

  function flash(message) {
    notice.value = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = '' }, 8000)
  }

  const add = (collection, item) => { state[collection].unshift({ id: `${collection}-${Date.now()}`, createdAt: new Date().toISOString(), ...item }); persist() }
  const update = (collection, id, patch) => { const item = state[collection].find((entry) => entry.id === id); if (item) Object.assign(item, patch); persist() }
  const remove = (collection, id) => { state[collection] = state[collection].filter((entry) => entry.id !== id); persist() }

  // 恢复演示数据：先对当前三类数据做完整快照，再整体替换，保证新旧数据不混杂。
  const restoreDemo = () => {
    const counts = Object.fromEntries(COLLECTIONS.map((key) => [key, state[key].length]))
    const snapshot = {
      at: new Date().toISOString(),
      counts,
      data: Object.fromEntries(COLLECTIONS.map((key) => [key, clone(state[key])])),
    }
    storage.writeSnapshot(snapshot)
    savedSnapshot.value = snapshot
    replaceInto(state, seed)
    persist()
    flash('已恢复为演示数据，当前数据已自动备份，可随时撤销。')
  }

  // 撤销恢复：用快照中的三类数据整体替换当前状态，总览、提醒、榜单随之回到原状。
  const undoRestore = () => {
    if (!savedSnapshot.value?.data || !isComplete(savedSnapshot.value.data)) {
      storage.removeSnapshot()
      savedSnapshot.value = null
      return false
    }
    replaceInto(state, savedSnapshot.value.data)
    persist()
    storage.removeSnapshot()
    savedSnapshot.value = null
    flash('已撤销恢复，档案、保单和使用记录均已回到恢复前的状态。')
    return true
  }

  const metrics = computed(() => config.metrics.map((metric) => ({ ...metric, value: metric.value ? metric.value(state) : state[metric.collection]?.length || 0 })))
  return { state, add, update, remove, restoreDemo, undoRestore, persist, metrics, snapshotAt, snapshotCounts, canUndo: computed(() => !!savedSnapshot.value), notice }
}

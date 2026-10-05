export function createStorage(key, seed, snapshotKey) {
  const read = () => { try { return JSON.parse(localStorage.getItem(key)) || structuredClone(seed) } catch { return structuredClone(seed) } }
  const write = (value) => localStorage.setItem(key, JSON.stringify(value))
  const readSnapshot = () => {
    if (!snapshotKey) return null
    try { return JSON.parse(localStorage.getItem(snapshotKey)) } catch { return null }
  }
  const writeSnapshot = (snapshot) => { if (snapshotKey) localStorage.setItem(snapshotKey, JSON.stringify(snapshot)) }
  const removeSnapshot = () => { if (snapshotKey) localStorage.removeItem(snapshotKey) }
  return { read, write, readSnapshot, writeSnapshot, removeSnapshot }
}

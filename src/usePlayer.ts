import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { cloud, cloudError, fetchProgress, pushProgress, type CloudSnapshot } from './cloud'
import { readProfile, writeProfile } from './storage'
import type { Profile } from './game'

function readMeta(id: string) {
  try { return JSON.parse(localStorage.getItem(`feast-cloud-meta:${id}`) ?? '{}') as { revision?: number; uploadedAt?: number } } catch { return {} }
}
export function usePlayer() {
  const [profile, setProfile] = useState(() => readProfile())
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!cloud)
  const [status, setStatus] = useState(cloud ? '正在连接账号' : '本机存档 · 云端未开通')
  const [conflict, setConflict] = useState<CloudSnapshot | null>(null)
  const [storageError, setStorageError] = useState(false)
  const latest = useRef(profile), account = useRef<string | null | undefined>(undefined)
  const revision = useRef(0), uploadedAt = useRef(0), busy = useRef(false), generation = useRef(0)
  const readyRef = useRef(ready), conflictRef = useRef(conflict)
  latest.current = profile; readyRef.current = ready; conflictRef.current = conflict
  const saveMeta = (id: string) => {
    try { localStorage.setItem(`feast-cloud-meta:${id}`, JSON.stringify({ revision: revision.current, uploadedAt: uploadedAt.current })) } catch { /* Local write error is surfaced separately. */ }
  }

  const connect = useCallback(async (nextUser: User | null, force = false) => {
    const id = nextUser?.id ?? null
    if (account.current === id && !force) return
    const token = ++generation.current
    account.current = id; setReady(false); setConflict(null); setUser(nextUser)
    const local = readProfile(id ?? 'guest', nextUser?.user_metadata?.name ?? nextUser?.email?.split('@')[0])
    setProfile(local)
    if (!id) { revision.current = 0; uploadedAt.current = 0; setStatus(cloud ? '游客 · 仅保存在本机' : '本机存档 · 云端未开通'); setReady(true); return }
    setStatus('正在读取云存档')
    try {
      const remote = await fetchProgress(id)
      if (token !== generation.current) return
      const meta = readMeta(id)
      revision.current = remote?.revision ?? 0
      uploadedAt.current = remote?.profile.updatedAt ?? 0
      if (remote) {
        if (local.updatedAt > remote.profile.updatedAt && local.updatedAt > (meta.uploadedAt ?? 0)) {
          if (meta.revision !== remote.revision) { setConflict(remote); setStatus('发现另一台设备的进度') }
          else setStatus('本机有新进度，等待同步')
        } else { setProfile(remote.profile); writeProfile(remote.profile); setStatus('云存档已同步') }
      } else setStatus('账号已连接，等待首份存档')
      saveMeta(id)
      setReady(true)
    } catch (error) {
      if (token !== generation.current) return
      // Preserve unsynced local play. Never upload before a successful remote read.
      setStatus(`云端暂不可用：${cloudError(error)}`); setReady(true); revision.current = -1
    }
  }, [])

  useEffect(() => {
    if (!cloud) return
    const { data } = cloud.auth.onAuthStateChange((_event, session) => { void connect(session?.user ?? null) })
    void cloud.auth.getSession().then(({ data, error }) => { if (error) { setStatus(cloudError(error)); setReady(true) } else void connect(data.session?.user ?? null) })
    return () => { data.subscription.unsubscribe(); generation.current++ }
  }, [connect])
  useEffect(() => { setStorageError(!writeProfile(profile)) }, [profile])

  const sync = useCallback(async () => {
    const p = latest.current
    if (!cloud || !account.current || !readyRef.current || conflictRef.current || busy.current || p.id !== account.current) return
    if (revision.current < 0) { await connect((await cloud.auth.getUser()).data.user, true); return }
    if (p.updatedAt <= uploadedAt.current || p.updatedAt === 0) return
    busy.current = true
    const token = generation.current
    setStatus('正在同步进度')
    try {
      const nextRevision = await pushProgress(p, revision.current)
      if (token !== generation.current) return
      revision.current = nextRevision; uploadedAt.current = p.updatedAt; saveMeta(p.id); setStatus('云存档已同步')
    } catch (error) {
      if (token !== generation.current) return
      if (cloudError(error).includes('SAVE_CONFLICT')) {
        try { const remote = await fetchProgress(p.id); if (remote && token === generation.current) { setConflict(remote); setStatus('另一台设备更新了进度，请选择存档') } } catch { setStatus('同步未完成，进度保留在本机') }
      } else setStatus(`待同步：${cloudError(error)}`)
    } finally { busy.current = false }
  }, [connect])
  useEffect(() => {
    const timer = window.setInterval(() => void sync(), 5000)
    const online = () => void sync()
    window.addEventListener('online', online)
    return () => { clearInterval(timer); window.removeEventListener('online', online) }
  }, [sync])
  const resolve = (choice: 'local' | 'remote') => {
    if (!conflict) return
    revision.current = conflict.revision
    if (choice === 'remote') { setProfile(conflict.profile); uploadedAt.current = conflict.profile.updatedAt }
    else setProfile(p => ({ ...p, updatedAt: Date.now() }))
    saveMeta(latest.current.id); setConflict(null); setStatus('存档选择已保存，等待同步')
  }
  const signOut = async () => { await sync(); await cloud?.auth.signOut({ scope: 'local' }) }
  return { profile, setProfile, user, ready, status, conflict, resolve, sync, signOut, storageError }
}

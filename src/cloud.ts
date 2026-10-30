import { createClient } from '@supabase/supabase-js'
import { validProfile } from './storage.ts'
import type { Profile } from './game.ts'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const cloud = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, db: { schema: 'public' } }) : null
export interface CloudSnapshot { profile: Profile; revision: number }
export async function fetchProgress(userId: string): Promise<CloudSnapshot | null> {
  if (!cloud) throw new Error('云存档尚未开通')
  const { data, error } = await cloud.from('player_progress').select('save, revision').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const profile = validProfile(data.save, userId)
  if (!profile) throw new Error('云存档格式不兼容，请保留本地备份并联系管理员')
  return { profile, revision: Number(data.revision) }
}
export async function pushProgress(profile: Profile, expectedRevision: number): Promise<number> {
  if (!cloud) throw new Error('云存档尚未开通')
  const { data, error } = await cloud.rpc('save_player_progress', { p_save: profile, p_expected_revision: expectedRevision })
  if (error) throw error
  return Number(data)
}
export const cloudError = (error: unknown) => {
  const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error)
  if (/Invalid login credentials/i.test(msg)) return '邮箱或密码不正确'
  if (/Email not confirmed/i.test(msg)) return '请先在邮箱中确认注册邮件'
  if (/rate limit|too many/i.test(msg)) return '请求过于频繁，请稍后重试'
  if (/fetch|network|offline/i.test(msg)) return '网络不可用，进度已保存在本机，恢复网络后重试'
  if (/relation|does not exist|schema cache/i.test(msg)) return '云存档表尚未创建，请管理员运行建表脚本'
  return msg
}

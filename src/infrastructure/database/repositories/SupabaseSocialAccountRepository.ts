import { ISocialAccountRepository } from '../../../domain/repositories/ISocialAccountRepository.js'
import { SocialAccount, SocialPlatform } from '../../../domain/entities/SocialAccount.js'
import { supabase } from '../supabase/client.js'

interface SocialAccountRow {
  id: string
  user_id: string
  campaign_id: string
  platform: SocialPlatform
  platform_user_id: string
  platform_username: string | null
  platform_name: string | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  page_id: string | null
  page_name: string | null
  page_access_token: string | null
  profile_picture_url: string | null
  scopes: string[] | null
  is_active: boolean
  connected_at: string
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export class SupabaseSocialAccountRepository implements ISocialAccountRepository {
  private mapRowToEntity(row: SocialAccountRow): SocialAccount {
    return SocialAccount.create({
      id: row.id,
      userId: row.user_id,
      campaignId: row.campaign_id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      platformUsername: row.platform_username ?? undefined,
      platformName: row.platform_name ?? undefined,
      accessToken: row.access_token,
      refreshToken: row.refresh_token ?? undefined,
      tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : undefined,
      pageId: row.page_id ?? undefined,
      pageName: row.page_name ?? undefined,
      pageAccessToken: row.page_access_token ?? undefined,
      profilePictureUrl: row.profile_picture_url ?? undefined,
      scopes: row.scopes ?? undefined,
      isActive: row.is_active,
      connectedAt: new Date(row.connected_at),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    })
  }

  private mapEntityToRow(account: SocialAccount): Omit<SocialAccountRow, 'id' | 'created_at'> {
    return {
      user_id: account.userId,
      campaign_id: account.campaignId,
      platform: account.platform,
      platform_user_id: account.platformUserId,
      platform_username: account.platformUsername ?? null,
      platform_name: account.platformName ?? null,
      access_token: account.accessToken,
      refresh_token: account.refreshToken ?? null,
      token_expires_at: account.tokenExpiresAt?.toISOString() ?? null,
      page_id: account.pageId ?? null,
      page_name: account.pageName ?? null,
      page_access_token: account.pageAccessToken ?? null,
      profile_picture_url: account.profilePictureUrl ?? null,
      scopes: account.scopes ?? null,
      is_active: account.isActive,
      connected_at: account.connectedAt.toISOString(),
      last_used_at: account.lastUsedAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    }
  }

  async findById(id: string): Promise<SocialAccount | null> {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    return this.mapRowToEntity(data as SocialAccountRow)
  }

  async findByUserId(userId: string): Promise<SocialAccount[]> {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as SocialAccountRow[]).map(row => this.mapRowToEntity(row))
  }

  async findByCampaignId(campaignId: string): Promise<SocialAccount[]> {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('platform')

    if (error) throw error
    return (data as SocialAccountRow[]).map(row => this.mapRowToEntity(row))
  }

  async findByPlatformUserId(platform: SocialPlatform, platformUserId: string, pageId?: string): Promise<SocialAccount | null> {
    let query = supabase
      .from('social_accounts')
      .select('*')
      .eq('platform', platform)
      .eq('platform_user_id', platformUserId)

    if (pageId) {
      query = query.eq('page_id', pageId)
    }

    const { data, error } = await query.single()

    if (error || !data) return null
    return this.mapRowToEntity(data as SocialAccountRow)
  }

  async findActiveByPlatform(campaignId: string, platform: SocialPlatform): Promise<SocialAccount[]> {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('platform', platform)
      .eq('is_active', true)

    if (error) throw error
    return (data as SocialAccountRow[]).map(row => this.mapRowToEntity(row))
  }

  async findWithExpiringTokens(withinMinutes: number): Promise<SocialAccount[]> {
    const expirationThreshold = new Date(Date.now() + withinMinutes * 60 * 1000)

    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('is_active', true)
      .not('token_expires_at', 'is', null)
      .lt('token_expires_at', expirationThreshold.toISOString())

    if (error) throw error
    return (data as SocialAccountRow[]).map(row => this.mapRowToEntity(row))
  }

  async save(account: SocialAccount): Promise<SocialAccount> {
    const row = this.mapEntityToRow(account)

    const { data, error } = await supabase
      .from('social_accounts')
      .insert(row)
      .select()
      .single()

    if (error) throw error
    return this.mapRowToEntity(data as SocialAccountRow)
  }

  async update(account: SocialAccount): Promise<SocialAccount> {
    if (!account.id) throw new Error('Account ID is required for update')

    const row = this.mapEntityToRow(account)

    const { data, error } = await supabase
      .from('social_accounts')
      .update(row)
      .eq('id', account.id)
      .select()
      .single()

    if (error) throw error
    return this.mapRowToEntity(data as SocialAccountRow)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

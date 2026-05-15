import { IPublicationLogRepository, PublicationLogFilters } from '../../../domain/repositories/IPublicationLogRepository.js'
import { PaginationOptions, PaginatedResult } from '../../../domain/repositories/IVideoCutRepository.js'
import { PublicationLog, PublicationAction } from '../../../domain/entities/PublicationLog.js'
import { SocialPlatform } from '../../../domain/entities/SocialAccount.js'
import { supabase } from '../supabase/client.js'

interface PublicationLogRow {
  id: string
  scheduled_post_id: string | null
  video_cut_id: string
  social_account_id: string
  campaign_id: string
  user_id: string | null
  action: PublicationAction
  platform: SocialPlatform
  details: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export class SupabasePublicationLogRepository implements IPublicationLogRepository {
  private mapRowToEntity(row: PublicationLogRow): PublicationLog {
    return PublicationLog.create({
      id: row.id,
      scheduledPostId: row.scheduled_post_id ?? undefined,
      videoCutId: row.video_cut_id,
      socialAccountId: row.social_account_id,
      campaignId: row.campaign_id,
      userId: row.user_id ?? undefined,
      action: row.action,
      platform: row.platform,
      details: row.details ?? undefined,
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
      createdAt: new Date(row.created_at),
    })
  }

  private mapEntityToRow(log: PublicationLog): Omit<PublicationLogRow, 'id'> {
    return {
      scheduled_post_id: log.scheduledPostId ?? null,
      video_cut_id: log.videoCutId,
      social_account_id: log.socialAccountId,
      campaign_id: log.campaignId,
      user_id: log.userId ?? null,
      action: log.action,
      platform: log.platform,
      details: log.details ?? null,
      ip_address: log.ipAddress ?? null,
      user_agent: log.userAgent ?? null,
      created_at: log.createdAt.toISOString(),
    }
  }

  async findById(id: string): Promise<PublicationLog | null> {
    const { data, error } = await supabase
      .from('publication_logs')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    return this.mapRowToEntity(data as PublicationLogRow)
  }

  async findByCampaignId(
    campaignId: string,
    filters?: PublicationLogFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<PublicationLog>> {
    let query = supabase
      .from('publication_logs')
      .select('*', { count: 'exact' })
      .eq('campaign_id', campaignId)

    if (filters?.action && filters.action.length > 0) {
      query = query.in('action', filters.action)
    }

    if (filters?.platform && filters.platform.length > 0) {
      query = query.in('platform', filters.platform)
    }

    if (filters?.fromDate) {
      query = query.gte('created_at', filters.fromDate.toISOString())
    }

    if (filters?.toDate) {
      query = query.lte('created_at', filters.toDate.toISOString())
    }

    if (filters?.videoCutId) {
      query = query.eq('video_cut_id', filters.videoCutId)
    }

    query = query.order('created_at', { ascending: false })

    const page = pagination?.page ?? 1
    const perPage = pagination?.perPage ?? 20
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    const total = count ?? 0
    const totalPages = Math.ceil(total / perPage)

    return {
      data: (data as PublicationLogRow[]).map(row => this.mapRowToEntity(row)),
      total,
      page,
      perPage,
      totalPages,
    }
  }

  async findByVideoCutId(videoCutId: string): Promise<PublicationLog[]> {
    const { data, error } = await supabase
      .from('publication_logs')
      .select('*')
      .eq('video_cut_id', videoCutId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as PublicationLogRow[]).map(row => this.mapRowToEntity(row))
  }

  async findByScheduledPostId(scheduledPostId: string): Promise<PublicationLog[]> {
    const { data, error } = await supabase
      .from('publication_logs')
      .select('*')
      .eq('scheduled_post_id', scheduledPostId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as PublicationLogRow[]).map(row => this.mapRowToEntity(row))
  }

  async save(log: PublicationLog): Promise<PublicationLog> {
    const row = this.mapEntityToRow(log)

    const { data, error } = await supabase
      .from('publication_logs')
      .insert(row)
      .select()
      .single()

    if (error) throw error
    return this.mapRowToEntity(data as PublicationLogRow)
  }
}

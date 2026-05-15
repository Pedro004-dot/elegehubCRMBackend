import { IScheduledPostRepository, ScheduledPostFilters } from '../../../domain/repositories/IScheduledPostRepository.js'
import { PaginationOptions, PaginatedResult } from '../../../domain/repositories/IVideoCutRepository.js'
import { ScheduledPost, ScheduledPostStatus } from '../../../domain/entities/ScheduledPost.js'
import { SocialPlatform } from '../../../domain/entities/SocialAccount.js'
import { supabase } from '../supabase/client.js'

interface ScheduledPostRow {
  id: string
  video_cut_id: string
  social_account_id: string
  campaign_id: string
  platform: SocialPlatform
  caption: string | null
  hashtags: string[] | null
  scheduled_for: string
  status: ScheduledPostStatus
  platform_post_id: string | null
  platform_post_url: string | null
  error_message: string | null
  retry_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export class SupabaseScheduledPostRepository implements IScheduledPostRepository {
  private mapRowToEntity(row: ScheduledPostRow): ScheduledPost {
    return ScheduledPost.create({
      id: row.id,
      videoCutId: row.video_cut_id,
      socialAccountId: row.social_account_id,
      campaignId: row.campaign_id,
      platform: row.platform,
      caption: row.caption ?? undefined,
      hashtags: row.hashtags ?? undefined,
      scheduledFor: new Date(row.scheduled_for),
      status: row.status,
      platformPostId: row.platform_post_id ?? undefined,
      platformPostUrl: row.platform_post_url ?? undefined,
      errorMessage: row.error_message ?? undefined,
      retryCount: row.retry_count,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    })
  }

  private mapEntityToRow(post: ScheduledPost): Omit<ScheduledPostRow, 'id' | 'created_at'> {
    return {
      video_cut_id: post.videoCutId,
      social_account_id: post.socialAccountId,
      campaign_id: post.campaignId,
      platform: post.platform,
      caption: post.caption ?? null,
      hashtags: post.hashtags ?? null,
      scheduled_for: post.scheduledFor.toISOString(),
      status: post.status,
      platform_post_id: post.platformPostId ?? null,
      platform_post_url: post.platformPostUrl ?? null,
      error_message: post.errorMessage ?? null,
      retry_count: post.retryCount,
      published_at: post.publishedAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    }
  }

  async findById(id: string): Promise<ScheduledPost | null> {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    return this.mapRowToEntity(data as ScheduledPostRow)
  }

  async findByCampaignId(
    campaignId: string,
    filters?: ScheduledPostFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<ScheduledPost>> {
    let query = supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact' })
      .eq('campaign_id', campaignId)

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }

    if (filters?.platform) {
      query = query.eq('platform', filters.platform)
    }

    if (filters?.fromDate) {
      query = query.gte('scheduled_for', filters.fromDate.toISOString())
    }

    if (filters?.toDate) {
      query = query.lte('scheduled_for', filters.toDate.toISOString())
    }

    if (filters?.videoCutId) {
      query = query.eq('video_cut_id', filters.videoCutId)
    }

    query = query.order('scheduled_for', { ascending: true })

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
      data: (data as ScheduledPostRow[]).map(row => this.mapRowToEntity(row)),
      total,
      page,
      perPage,
      totalPages,
    }
  }

  async findByVideoCutId(videoCutId: string): Promise<ScheduledPost[]> {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('video_cut_id', videoCutId)
      .order('scheduled_for', { ascending: true })

    if (error) throw error
    return (data as ScheduledPostRow[]).map(row => this.mapRowToEntity(row))
  }

  async findDueForPublishing(beforeDate: Date): Promise<ScheduledPost[]> {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', beforeDate.toISOString())
      .order('scheduled_for', { ascending: true })

    if (error) throw error
    return (data as ScheduledPostRow[]).map(row => this.mapRowToEntity(row))
  }

  async findPendingBySocialAccount(socialAccountId: string): Promise<ScheduledPost[]> {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('social_account_id', socialAccountId)
      .in('status', ['pending', 'processing'])
      .order('scheduled_for', { ascending: true })

    if (error) throw error
    return (data as ScheduledPostRow[]).map(row => this.mapRowToEntity(row))
  }

  async save(post: ScheduledPost): Promise<ScheduledPost> {
    const row = this.mapEntityToRow(post)

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert(row)
      .select()
      .single()

    if (error) throw error
    return this.mapRowToEntity(data as ScheduledPostRow)
  }

  async update(post: ScheduledPost): Promise<ScheduledPost> {
    if (!post.id) throw new Error('ScheduledPost ID is required for update')

    const row = this.mapEntityToRow(post)

    const { data, error } = await supabase
      .from('scheduled_posts')
      .update(row)
      .eq('id', post.id)
      .select()
      .single()

    if (error) throw error
    return this.mapRowToEntity(data as ScheduledPostRow)
  }

  async updateStatus(id: string, status: ScheduledPostStatus, errorMessage?: string): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (errorMessage !== undefined) {
      updateData.error_message = errorMessage
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .update(updateData)
      .eq('id', id)

    if (error) throw error
  }

  async markAsPublished(id: string, platformPostId: string, platformPostUrl?: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'published',
        platform_post_id: platformPostId,
        platform_post_url: platformPostUrl ?? null,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
  }

  async incrementRetry(id: string): Promise<void> {
    const { data: current } = await supabase
      .from('scheduled_posts')
      .select('retry_count')
      .eq('id', id)
      .single()

    const newRetryCount = (current?.retry_count ?? 0) + 1

    const { error } = await supabase
      .from('scheduled_posts')
      .update({
        retry_count: newRetryCount,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_posts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

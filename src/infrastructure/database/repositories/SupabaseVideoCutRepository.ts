import { IVideoCutRepository, VideoCutFilters, PaginationOptions, PaginatedResult } from '../../../domain/repositories/IVideoCutRepository.js'
import { VideoCut, VideoCutStatus, VideoCutFormat, ChannelRecommendation } from '../../../domain/entities/VideoCut.js'
import { supabase } from '../supabase/client.js'

interface VideoCutRow {
  id: string
  campaign_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string | null
  storage_path: string | null
  duration: number
  format: VideoCutFormat
  file_size: number | null
  status: VideoCutStatus
  viral_score: number | null
  viral_score_reasons: string[] | null
  transcription: string | null
  suggested_caption: string | null
  suggested_hashtags: string[] | null
  source_session: string | null
  tags: string[] | null
  channel_recommendations: ChannelRecommendation[] | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export class SupabaseVideoCutRepository implements IVideoCutRepository {
  private mapRowToEntity(row: VideoCutRow): VideoCut {
    return VideoCut.create({
      id: row.id,
      campaignId: row.campaign_id,
      title: row.title,
      description: row.description ?? undefined,
      thumbnailUrl: row.thumbnail_url ?? undefined,
      videoUrl: row.video_url ?? undefined,
      storagePath: row.storage_path ?? undefined,
      duration: row.duration,
      format: row.format,
      fileSize: row.file_size ?? undefined,
      status: row.status,
      viralScore: row.viral_score ?? undefined,
      viralScoreReasons: row.viral_score_reasons ?? undefined,
      transcription: row.transcription ?? undefined,
      suggestedCaption: row.suggested_caption ?? undefined,
      suggestedHashtags: row.suggested_hashtags ?? undefined,
      sourceSession: row.source_session ?? undefined,
      tags: row.tags ?? undefined,
      channelRecommendations: row.channel_recommendations ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    })
  }

  private mapEntityToRow(videoCut: VideoCut): Omit<VideoCutRow, 'id' | 'created_at'> {
    return {
      campaign_id: videoCut.campaignId,
      title: videoCut.title,
      description: videoCut.description ?? null,
      thumbnail_url: videoCut.thumbnailUrl ?? null,
      video_url: videoCut.videoUrl ?? null,
      storage_path: videoCut.storagePath ?? null,
      duration: videoCut.duration,
      format: videoCut.format,
      file_size: videoCut.fileSize ?? null,
      status: videoCut.status,
      viral_score: videoCut.viralScore ?? null,
      viral_score_reasons: videoCut.viralScoreReasons ?? null,
      transcription: videoCut.transcription ?? null,
      suggested_caption: videoCut.suggestedCaption ?? null,
      suggested_hashtags: videoCut.suggestedHashtags ?? null,
      source_session: videoCut.sourceSession ?? null,
      tags: videoCut.tags ?? null,
      channel_recommendations: videoCut.channelRecommendations ?? null,
      updated_at: new Date().toISOString(),
      published_at: videoCut.publishedAt?.toISOString() ?? null,
    }
  }

  async findById(id: string): Promise<VideoCut | null> {
    const { data, error } = await supabase
      .from('video_cuts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    return this.mapRowToEntity(data as VideoCutRow)
  }

  async findByCampaignId(
    campaignId: string,
    filters?: VideoCutFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<VideoCut>> {
    let query = supabase
      .from('video_cuts')
      .select('*', { count: 'exact' })
      .eq('campaign_id', campaignId)

    // Aplicar filtros
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags)
    }

    if (filters?.fromDate) {
      query = query.gte('created_at', filters.fromDate.toISOString())
    }

    if (filters?.toDate) {
      query = query.lte('created_at', filters.toDate.toISOString())
    }

    // Ordenação
    query = query.order('created_at', { ascending: false })

    // Paginação
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
      data: (data as VideoCutRow[]).map(row => this.mapRowToEntity(row)),
      total,
      page,
      perPage,
      totalPages,
    }
  }

  async findReadyForPublishing(campaignId: string): Promise<VideoCut[]> {
    const { data, error } = await supabase
      .from('video_cuts')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data as VideoCutRow[]).map(row => this.mapRowToEntity(row))
  }

  async save(videoCut: VideoCut): Promise<VideoCut> {
    const row = this.mapEntityToRow(videoCut)

    const { data, error } = await supabase
      .from('video_cuts')
      .insert(row)
      .select()
      .single()

    if (error) throw error
    return this.mapRowToEntity(data as VideoCutRow)
  }

  async update(videoCut: VideoCut): Promise<VideoCut> {
    if (!videoCut.id) throw new Error('VideoCut ID is required for update')

    const row = this.mapEntityToRow(videoCut)

    const { data, error } = await supabase
      .from('video_cuts')
      .update(row)
      .eq('id', videoCut.id)
      .select()
      .single()

    if (error) throw error
    return this.mapRowToEntity(data as VideoCutRow)
  }

  async updateStatus(id: string, status: VideoCutStatus): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'published') {
      updateData.published_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('video_cuts')
      .update(updateData)
      .eq('id', id)

    if (error) throw error
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('video_cuts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

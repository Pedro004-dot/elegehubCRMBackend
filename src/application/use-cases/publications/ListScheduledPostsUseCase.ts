import { IScheduledPostRepository, ScheduledPostFilters } from '../../../domain/repositories/IScheduledPostRepository.js'
import { PaginationOptions, PaginatedResult } from '../../../domain/repositories/IVideoCutRepository.js'
import { ScheduledPost } from '../../../domain/entities/ScheduledPost.js'

export interface ScheduledPostDTO {
  id: string
  videoCutId: string
  socialAccountId: string
  platform: string
  caption?: string
  hashtags?: string[]
  scheduledFor: Date
  status: string
  platformPostId?: string
  platformPostUrl?: string
  errorMessage?: string
  retryCount: number
  publishedAt?: Date
  createdAt: Date
}

export interface ListScheduledPostsInput {
  campaignId: string
  filters?: ScheduledPostFilters
  pagination?: PaginationOptions
}

export class ListScheduledPostsUseCase {
  constructor(
    private scheduledPostRepository: IScheduledPostRepository
  ) {}

  async execute(input: ListScheduledPostsInput): Promise<PaginatedResult<ScheduledPostDTO>> {
    const { campaignId, filters, pagination } = input

    const result = await this.scheduledPostRepository.findByCampaignId(
      campaignId,
      filters,
      pagination
    )

    return {
      ...result,
      data: result.data.map(post => this.mapToDTO(post)),
    }
  }

  private mapToDTO(post: ScheduledPost): ScheduledPostDTO {
    return {
      id: post.id!,
      videoCutId: post.videoCutId,
      socialAccountId: post.socialAccountId,
      platform: post.platform,
      caption: post.caption,
      hashtags: post.hashtags,
      scheduledFor: post.scheduledFor,
      status: post.status,
      platformPostId: post.platformPostId,
      platformPostUrl: post.platformPostUrl,
      errorMessage: post.errorMessage,
      retryCount: post.retryCount,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
    }
  }
}

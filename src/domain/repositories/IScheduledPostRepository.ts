import { ScheduledPost, ScheduledPostStatus } from '../entities/ScheduledPost.js'
import { PaginatedResult, PaginationOptions } from './IVideoCutRepository.js'

export interface ScheduledPostFilters {
  status?: ScheduledPostStatus[]
  platform?: string
  fromDate?: Date
  toDate?: Date
  videoCutId?: string
}

export interface IScheduledPostRepository {
  findById(id: string): Promise<ScheduledPost | null>
  findByCampaignId(campaignId: string, filters?: ScheduledPostFilters, pagination?: PaginationOptions): Promise<PaginatedResult<ScheduledPost>>
  findByVideoCutId(videoCutId: string): Promise<ScheduledPost[]>
  findDueForPublishing(beforeDate: Date): Promise<ScheduledPost[]>
  findPendingBySocialAccount(socialAccountId: string): Promise<ScheduledPost[]>
  save(post: ScheduledPost): Promise<ScheduledPost>
  update(post: ScheduledPost): Promise<ScheduledPost>
  updateStatus(id: string, status: ScheduledPostStatus, errorMessage?: string): Promise<void>
  markAsPublished(id: string, platformPostId: string, platformPostUrl?: string): Promise<void>
  incrementRetry(id: string): Promise<void>
  delete(id: string): Promise<void>
}

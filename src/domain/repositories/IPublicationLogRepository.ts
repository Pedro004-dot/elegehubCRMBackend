import { PublicationLog, PublicationAction } from '../entities/PublicationLog.js'
import { SocialPlatform } from '../entities/SocialAccount.js'
import { PaginatedResult, PaginationOptions } from './IVideoCutRepository.js'

export interface PublicationLogFilters {
  action?: PublicationAction[]
  platform?: SocialPlatform[]
  fromDate?: Date
  toDate?: Date
  videoCutId?: string
}

export interface IPublicationLogRepository {
  findById(id: string): Promise<PublicationLog | null>
  findByCampaignId(campaignId: string, filters?: PublicationLogFilters, pagination?: PaginationOptions): Promise<PaginatedResult<PublicationLog>>
  findByVideoCutId(videoCutId: string): Promise<PublicationLog[]>
  findByScheduledPostId(scheduledPostId: string): Promise<PublicationLog[]>
  save(log: PublicationLog): Promise<PublicationLog>
}

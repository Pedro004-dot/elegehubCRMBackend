import { SocialAccount, SocialPlatform } from '../entities/SocialAccount.js'

export interface ISocialAccountRepository {
  findById(id: string): Promise<SocialAccount | null>
  findByUserId(userId: string): Promise<SocialAccount[]>
  findByCampaignId(campaignId: string): Promise<SocialAccount[]>
  findByPlatformUserId(platform: SocialPlatform, platformUserId: string, pageId?: string): Promise<SocialAccount | null>
  findActiveByPlatform(campaignId: string, platform: SocialPlatform): Promise<SocialAccount[]>
  findWithExpiringTokens(withinMinutes: number): Promise<SocialAccount[]>
  save(account: SocialAccount): Promise<SocialAccount>
  update(account: SocialAccount): Promise<SocialAccount>
  delete(id: string): Promise<void>
}

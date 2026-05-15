import { ISocialAccountRepository } from '../../../domain/repositories/ISocialAccountRepository.js'
import { SocialAccount } from '../../../domain/entities/SocialAccount.js'

export interface ListSocialAccountsInput {
  campaignId: string
}

export interface SocialAccountDTO {
  id: string
  platform: string
  platformUsername?: string
  platformName?: string
  pageId?: string
  pageName?: string
  profilePictureUrl?: string
  isActive: boolean
  connectedAt: Date
  tokenExpiresAt?: Date
  isTokenExpiring: boolean
}

export class ListSocialAccountsUseCase {
  constructor(
    private socialAccountRepository: ISocialAccountRepository
  ) {}

  async execute(input: ListSocialAccountsInput): Promise<SocialAccountDTO[]> {
    const { campaignId } = input

    const accounts = await this.socialAccountRepository.findByCampaignId(campaignId)

    return accounts.map(account => this.mapToDTO(account))
  }

  private mapToDTO(account: SocialAccount): SocialAccountDTO {
    // Verificar se token expira em 7 dias
    const isTokenExpiring = account.tokenExpiresAt
      ? new Date(account.tokenExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : false

    return {
      id: account.id!,
      platform: account.platform,
      platformUsername: account.platformUsername,
      platformName: account.platformName,
      pageId: account.pageId,
      pageName: account.pageName,
      profilePictureUrl: account.profilePictureUrl,
      isActive: account.isActive,
      connectedAt: account.connectedAt,
      tokenExpiresAt: account.tokenExpiresAt,
      isTokenExpiring,
    }
  }
}

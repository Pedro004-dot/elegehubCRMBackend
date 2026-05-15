import { ISocialAccountRepository } from '../../../domain/repositories/ISocialAccountRepository.js'
import { SocialAccount, SocialPlatform } from '../../../domain/entities/SocialAccount.js'
import { SocialProviderFactory } from '../../../infrastructure/providers/social/SocialProviderFactory.js'
import {
  SocialAccountAlreadyExistsError,
  OAuthCallbackError,
} from '../../../domain/errors/SocialAccountErrors.js'
import { PageInfo } from '../../../infrastructure/providers/social/ISocialMediaProvider.js'

export interface ConnectSocialAccountInput {
  userId: string
  campaignId: string
  platform: SocialPlatform
  code: string
  selectedPageId?: string // Para Facebook/Instagram
}

export interface ConnectSocialAccountOutput {
  account: SocialAccount
  availablePages?: PageInfo[]
}

export class ConnectSocialAccountUseCase {
  constructor(
    private socialAccountRepository: ISocialAccountRepository
  ) {}

  async execute(input: ConnectSocialAccountInput): Promise<ConnectSocialAccountOutput> {
    const { userId, campaignId, platform, code, selectedPageId } = input

    // Obter provider
    const provider = SocialProviderFactory.create(platform)
    const redirectUri = SocialProviderFactory.getRedirectUri(platform)

    // Trocar código por tokens
    let tokens
    try {
      tokens = await provider.exchangeCodeForTokens(code, redirectUri)
    } catch (error) {
      throw new OAuthCallbackError(
        error instanceof Error ? error.message : 'Erro ao trocar código por tokens'
      )
    }

    // Obter perfil do usuário
    const profile = await provider.getUserProfile(tokens.accessToken)

    // Para Facebook/Instagram, verificar se precisa selecionar página
    if ((platform === 'facebook' || platform === 'instagram') && profile.pages && profile.pages.length > 0) {
      if (!selectedPageId) {
        // Retornar lista de páginas para o usuário selecionar
        return {
          account: null as unknown as SocialAccount,
          availablePages: profile.pages,
        }
      }

      // Encontrar a página selecionada
      const selectedPage = profile.pages.find(p => p.id === selectedPageId)
      if (!selectedPage) {
        throw new OAuthCallbackError('Página selecionada não encontrada')
      }

      // Verificar se já existe conta para esta página
      const existingAccount = await this.socialAccountRepository.findByPlatformUserId(
        platform,
        profile.id,
        selectedPage.id
      )

      if (existingAccount && existingAccount.campaignId === campaignId) {
        throw new SocialAccountAlreadyExistsError(platform)
      }

      // Criar conta com dados da página
      const account = SocialAccount.create({
        userId,
        campaignId,
        platform,
        platformUserId: profile.id,
        platformUsername: profile.username,
        platformName: profile.name,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : undefined,
        pageId: selectedPage.id,
        pageName: selectedPage.name,
        pageAccessToken: selectedPage.accessToken,
        profilePictureUrl: profile.profilePictureUrl,
        scopes: tokens.scope,
      })

      const savedAccount = await this.socialAccountRepository.save(account)

      return { account: savedAccount }
    }

    // Para TikTok e YouTube (sem páginas)
    const existingAccount = await this.socialAccountRepository.findByPlatformUserId(
      platform,
      profile.id
    )

    if (existingAccount && existingAccount.campaignId === campaignId) {
      throw new SocialAccountAlreadyExistsError(platform)
    }

    const account = SocialAccount.create({
      userId,
      campaignId,
      platform,
      platformUserId: profile.id,
      platformUsername: profile.username,
      platformName: profile.name,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : undefined,
      profilePictureUrl: profile.profilePictureUrl,
      scopes: tokens.scope,
    })

    const savedAccount = await this.socialAccountRepository.save(account)

    return { account: savedAccount }
  }
}

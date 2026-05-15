import { ISocialAccountRepository } from '../../../domain/repositories/ISocialAccountRepository.js'
import { SocialAccount } from '../../../domain/entities/SocialAccount.js'
import { SocialProviderFactory } from '../../../infrastructure/providers/social/SocialProviderFactory.js'
import {
  SocialAccountNotFoundError,
  SocialAccountTokenExpiredError,
} from '../../../domain/errors/SocialAccountErrors.js'

export interface RefreshTokenInput {
  accountId: string
}

export class RefreshTokenUseCase {
  constructor(
    private socialAccountRepository: ISocialAccountRepository
  ) {}

  async execute(input: RefreshTokenInput): Promise<SocialAccount> {
    const { accountId } = input

    const account = await this.socialAccountRepository.findById(accountId)

    if (!account) {
      throw new SocialAccountNotFoundError(accountId)
    }

    // Verificar se tem refresh token
    if (!account.refreshToken) {
      throw new SocialAccountTokenExpiredError(account.platform)
    }

    // Obter provider
    const provider = SocialProviderFactory.create(account.platform)

    try {
      const tokens = await provider.refreshAccessToken(account.refreshToken)

      // Atualizar tokens
      account.updateTokens(
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : undefined
      )

      // Salvar
      return await this.socialAccountRepository.update(account)
    } catch (error) {
      // Se falhar, desativar conta
      account.deactivate()
      await this.socialAccountRepository.update(account)

      throw new SocialAccountTokenExpiredError(account.platform)
    }
  }
}

// Use case para atualizar tokens expirados em batch
export class RefreshExpiringTokensUseCase {
  constructor(
    private socialAccountRepository: ISocialAccountRepository,
    private refreshTokenUseCase: RefreshTokenUseCase
  ) {}

  async execute(withinMinutes: number = 60): Promise<{
    refreshed: number
    failed: number
    errors: Array<{ accountId: string; error: string }>
  }> {
    const accounts = await this.socialAccountRepository.findWithExpiringTokens(withinMinutes)

    let refreshed = 0
    let failed = 0
    const errors: Array<{ accountId: string; error: string }> = []

    for (const account of accounts) {
      try {
        await this.refreshTokenUseCase.execute({ accountId: account.id! })
        refreshed++
      } catch (error) {
        failed++
        errors.push({
          accountId: account.id!,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return { refreshed, failed, errors }
  }
}

import { ISocialAccountRepository } from '../../../domain/repositories/ISocialAccountRepository.js'
import { IScheduledPostRepository } from '../../../domain/repositories/IScheduledPostRepository.js'
import { SocialProviderFactory } from '../../../infrastructure/providers/social/SocialProviderFactory.js'
import { SocialAccountNotFoundError } from '../../../domain/errors/SocialAccountErrors.js'

export interface DisconnectSocialAccountInput {
  accountId: string
  userId?: string
  revokeAccess?: boolean
}

export class DisconnectSocialAccountUseCase {
  constructor(
    private socialAccountRepository: ISocialAccountRepository,
    private scheduledPostRepository: IScheduledPostRepository
  ) {}

  async execute(input: DisconnectSocialAccountInput): Promise<void> {
    const { accountId, userId, revokeAccess = false } = input

    // Buscar conta
    const account = await this.socialAccountRepository.findById(accountId)

    if (!account) {
      throw new SocialAccountNotFoundError(accountId)
    }

    // Verificar se o usuário é o dono da conta (se userId fornecido)
    if (userId && account.userId !== userId) {
      throw new Error('Você não tem permissão para desconectar esta conta')
    }

    // Cancelar publicações pendentes
    const pendingPosts = await this.scheduledPostRepository.findPendingBySocialAccount(accountId)
    for (const post of pendingPosts) {
      post.cancel()
      await this.scheduledPostRepository.update(post)
    }

    // Revogar acesso na plataforma se solicitado
    if (revokeAccess) {
      try {
        const provider = SocialProviderFactory.create(account.platform)
        await provider.revokeToken(account.accessToken)
      } catch (error) {
        // Log mas não falhar se revogação falhar
        console.error(`Erro ao revogar token: ${error}`)
      }
    }

    // Deletar conta
    await this.socialAccountRepository.delete(accountId)
  }
}

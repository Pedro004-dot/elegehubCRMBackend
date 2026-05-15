import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ListSocialAccountsUseCase } from '../../../application/use-cases/social-accounts/ListSocialAccountsUseCase.js'
import { DisconnectSocialAccountUseCase } from '../../../application/use-cases/social-accounts/DisconnectSocialAccountUseCase.js'
import { RefreshTokenUseCase } from '../../../application/use-cases/social-accounts/RefreshTokenUseCase.js'
import { SupabaseSocialAccountRepository } from '../../database/repositories/SupabaseSocialAccountRepository.js'
import { SupabaseScheduledPostRepository } from '../../database/repositories/SupabaseScheduledPostRepository.js'

const disconnectSchema = z.object({
  revokeAccess: z.boolean().optional().default(false),
})

export class SocialAccountsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaignId = req.params.campaignId as string

      const repository = new SupabaseSocialAccountRepository()
      const useCase = new ListSocialAccountsUseCase(repository)

      const accounts = await useCase.execute({ campaignId })

      res.json({
        success: true,
        data: accounts,
      })
    } catch (error) {
      next(error)
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string
      const userId = (req as any).userId as string | undefined
      const { revokeAccess } = disconnectSchema.parse(req.body)

      const socialAccountRepository = new SupabaseSocialAccountRepository()
      const scheduledPostRepository = new SupabaseScheduledPostRepository()
      const useCase = new DisconnectSocialAccountUseCase(
        socialAccountRepository,
        scheduledPostRepository
      )

      await useCase.execute({
        accountId: id,
        userId,
        revokeAccess,
      })

      res.json({
        success: true,
        message: 'Conta desconectada com sucesso',
      })
    } catch (error) {
      next(error)
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string

      const repository = new SupabaseSocialAccountRepository()
      const useCase = new RefreshTokenUseCase(repository)

      const account = await useCase.execute({ accountId: id })

      res.json({
        success: true,
        data: {
          id: account.id,
          tokenExpiresAt: account.tokenExpiresAt,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { SocialPlatform } from '../../../domain/entities/SocialAccount.js'
import { SocialProviderFactory } from '../../providers/social/SocialProviderFactory.js'
import { ConnectSocialAccountUseCase } from '../../../application/use-cases/social-accounts/ConnectSocialAccountUseCase.js'
import { SupabaseSocialAccountRepository } from '../../database/repositories/SupabaseSocialAccountRepository.js'
import { env } from '../../config/env.js'

// Schema de validação
const initiateOAuthSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'tiktok', 'youtube']),
})

const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

interface OAuthState {
  userId: string
  campaignId: string
  platform: SocialPlatform
  returnUrl: string
}

export class SocialAuthController {
  private stateStore: Map<string, OAuthState> = new Map()

  async initiateOAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform } = initiateOAuthSchema.parse(req.params)
      const { campaignId, returnUrl } = req.query

      // TODO: Obter userId do token JWT
      const userId = (req as any).userId

      if (!campaignId) {
        res.status(400).json({
          success: false,
          error: { message: 'campaignId é obrigatório' },
        })
        return
      }

      // Gerar state único
      const state = this.generateState()

      // Armazenar state
      this.stateStore.set(state, {
        userId,
        campaignId: campaignId as string,
        platform,
        returnUrl: (returnUrl as string) || `${env.CORS_ORIGINS}/configuracoes/redes-sociais`,
      })

      // Definir expiração do state (5 minutos)
      setTimeout(() => {
        this.stateStore.delete(state)
      }, 5 * 60 * 1000)

      // Obter URL de autorização
      const provider = SocialProviderFactory.create(platform)
      const redirectUri = SocialProviderFactory.getRedirectUri(platform)
      const authUrl = provider.getAuthorizationUrl(state, redirectUri)

      res.redirect(authUrl)
    } catch (error) {
      next(error)
    }
  }

  async handleMetaCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.handleCallback(req, res, 'facebook')
    } catch (error) {
      next(error)
    }
  }

  async handleTikTokCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.handleCallback(req, res, 'tiktok')
    } catch (error) {
      next(error)
    }
  }

  async handleGoogleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.handleCallback(req, res, 'youtube')
    } catch (error) {
      next(error)
    }
  }

  private async handleCallback(req: Request, res: Response, defaultPlatform: SocialPlatform): Promise<void> {
    const { code, state, error, error_description } = req.query

    // Verificar erro do OAuth
    if (error) {
      const errorMessage = error_description || error
      res.redirect(`${env.CORS_ORIGINS}/configuracoes/redes-sociais?error=${encodeURIComponent(errorMessage as string)}`)
      return
    }

    // Validar parâmetros
    const parsed = oauthCallbackSchema.safeParse({ code, state })
    if (!parsed.success) {
      res.redirect(`${env.CORS_ORIGINS}/configuracoes/redes-sociais?error=Parâmetros inválidos`)
      return
    }

    // Recuperar state
    const stateData = this.stateStore.get(state as string)
    if (!stateData) {
      res.redirect(`${env.CORS_ORIGINS}/configuracoes/redes-sociais?error=State inválido ou expirado`)
      return
    }

    // Remover state usado
    this.stateStore.delete(state as string)

    try {
      // Executar use case
      const repository = new SupabaseSocialAccountRepository()
      const useCase = new ConnectSocialAccountUseCase(repository)

      const result = await useCase.execute({
        userId: stateData.userId,
        campaignId: stateData.campaignId,
        platform: stateData.platform,
        code: code as string,
      })

      // Se há páginas para selecionar
      if (result.availablePages && result.availablePages.length > 0) {
        // Redirecionar para seleção de página
        const pagesParam = encodeURIComponent(JSON.stringify(result.availablePages))
        res.redirect(`${stateData.returnUrl}?selectPage=true&platform=${stateData.platform}&pages=${pagesParam}&code=${code}&state=${state}`)
        return
      }

      // Sucesso
      res.redirect(`${stateData.returnUrl}?success=true&platform=${stateData.platform}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao conectar conta'
      res.redirect(`${stateData.returnUrl}?error=${encodeURIComponent(errorMessage)}`)
    }
  }

  async selectPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, platform, pageId, campaignId } = req.body
      const userId = (req as any).userId

      const repository = new SupabaseSocialAccountRepository()
      const useCase = new ConnectSocialAccountUseCase(repository)

      const result = await useCase.execute({
        userId,
        campaignId,
        platform,
        code,
        selectedPageId: pageId,
      })

      res.json({
        success: true,
        data: {
          id: result.account.id,
          platform: result.account.platform,
          platformName: result.account.platformName,
          pageName: result.account.pageName,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  private generateState(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
}

import { ProcessScheduledPostsUseCase } from '../../application/use-cases/publications/ProcessScheduledPostsUseCase.js'
import { RefreshExpiringTokensUseCase, RefreshTokenUseCase } from '../../application/use-cases/social-accounts/RefreshTokenUseCase.js'
import { SupabaseSocialAccountRepository } from '../database/repositories/SupabaseSocialAccountRepository.js'
import { SupabaseVideoCutRepository } from '../database/repositories/SupabaseVideoCutRepository.js'
import { SupabaseScheduledPostRepository } from '../database/repositories/SupabaseScheduledPostRepository.js'
import { SupabasePublicationLogRepository } from '../database/repositories/SupabasePublicationLogRepository.js'

export class ScheduledPostsWorker {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private tokenRefreshIntervalId: NodeJS.Timeout | null = null

  // Intervalo de processamento de posts (1 minuto)
  private readonly PROCESS_INTERVAL_MS = 60 * 1000

  // Intervalo de refresh de tokens (30 minutos)
  private readonly TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000

  start(): void {
    if (this.isRunning) {
      console.log('[ScheduledPostsWorker] Worker já está rodando')
      return
    }

    this.isRunning = true
    console.log('[ScheduledPostsWorker] Iniciando worker...')

    // Processar posts pendentes a cada minuto
    this.intervalId = setInterval(async () => {
      await this.processScheduledPosts()
    }, this.PROCESS_INTERVAL_MS)

    // Refresh de tokens a cada 30 minutos
    this.tokenRefreshIntervalId = setInterval(async () => {
      await this.refreshExpiringTokens()
    }, this.TOKEN_REFRESH_INTERVAL_MS)

    // Executar imediatamente na primeira vez
    this.processScheduledPosts()
    this.refreshExpiringTokens()

    console.log('[ScheduledPostsWorker] Worker iniciado com sucesso')
  }

  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.tokenRefreshIntervalId) {
      clearInterval(this.tokenRefreshIntervalId)
      this.tokenRefreshIntervalId = null
    }

    console.log('[ScheduledPostsWorker] Worker parado')
  }

  private async processScheduledPosts(): Promise<void> {
    console.log('[ScheduledPostsWorker] Processando posts agendados...')

    try {
      const useCase = new ProcessScheduledPostsUseCase(
        new SupabaseSocialAccountRepository(),
        new SupabaseVideoCutRepository(),
        new SupabaseScheduledPostRepository(),
        new SupabasePublicationLogRepository()
      )

      const result = await useCase.execute()

      if (result.processed > 0) {
        console.log(
          `[ScheduledPostsWorker] Processados: ${result.processed}, ` +
          `Publicados: ${result.published}, ` +
          `Falharam: ${result.failed}, ` +
          `Tentativas: ${result.retried}`
        )

        if (result.errors.length > 0) {
          console.error('[ScheduledPostsWorker] Erros:', result.errors)
        }
      }
    } catch (error) {
      console.error('[ScheduledPostsWorker] Erro ao processar posts:', error)
    }
  }

  private async refreshExpiringTokens(): Promise<void> {
    console.log('[ScheduledPostsWorker] Verificando tokens expirando...')

    try {
      const socialAccountRepository = new SupabaseSocialAccountRepository()
      const refreshTokenUseCase = new RefreshTokenUseCase(socialAccountRepository)
      const useCase = new RefreshExpiringTokensUseCase(
        socialAccountRepository,
        refreshTokenUseCase
      )

      // Refresh tokens que expiram em 60 minutos
      const result = await useCase.execute(60)

      if (result.refreshed > 0 || result.failed > 0) {
        console.log(
          `[ScheduledPostsWorker] Tokens atualizados: ${result.refreshed}, ` +
          `Falhas: ${result.failed}`
        )

        if (result.errors.length > 0) {
          console.error('[ScheduledPostsWorker] Erros de refresh:', result.errors)
        }
      }
    } catch (error) {
      console.error('[ScheduledPostsWorker] Erro ao atualizar tokens:', error)
    }
  }
}

// Instância singleton do worker
export const scheduledPostsWorker = new ScheduledPostsWorker()

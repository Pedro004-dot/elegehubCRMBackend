import { ISocialAccountRepository } from '../../../domain/repositories/ISocialAccountRepository.js'
import { IVideoCutRepository } from '../../../domain/repositories/IVideoCutRepository.js'
import { IScheduledPostRepository } from '../../../domain/repositories/IScheduledPostRepository.js'
import { IPublicationLogRepository } from '../../../domain/repositories/IPublicationLogRepository.js'
import { PublicationLog } from '../../../domain/entities/PublicationLog.js'
import { SocialProviderFactory } from '../../../infrastructure/providers/social/SocialProviderFactory.js'

export interface ProcessScheduledPostsOutput {
  processed: number
  published: number
  failed: number
  retried: number
  errors: Array<{
    postId: string
    error: string
  }>
}

export class ProcessScheduledPostsUseCase {
  private static readonly MAX_RETRIES = 3

  constructor(
    private socialAccountRepository: ISocialAccountRepository,
    private videoCutRepository: IVideoCutRepository,
    private scheduledPostRepository: IScheduledPostRepository,
    private publicationLogRepository: IPublicationLogRepository
  ) {}

  async execute(): Promise<ProcessScheduledPostsOutput> {
    const now = new Date()
    const duePosts = await this.scheduledPostRepository.findDueForPublishing(now)

    const result: ProcessScheduledPostsOutput = {
      processed: 0,
      published: 0,
      failed: 0,
      retried: 0,
      errors: [],
    }

    for (const post of duePosts) {
      result.processed++

      try {
        // Marcar como processando
        post.startProcessing()
        await this.scheduledPostRepository.update(post)

        // Buscar conta e vídeo
        const account = await this.socialAccountRepository.findById(post.socialAccountId)
        const videoCut = await this.videoCutRepository.findById(post.videoCutId)

        if (!account || !videoCut) {
          throw new Error('Conta ou vídeo não encontrado')
        }

        // Verificar se token está expirado
        if (account.isTokenExpired()) {
          throw new Error('Token expirado')
        }

        // Verificar se precisa refresh de token
        if (account.needsTokenRefresh() && account.refreshToken) {
          try {
            const provider = SocialProviderFactory.create(account.platform)
            const tokens = await provider.refreshAccessToken(account.refreshToken)
            account.updateTokens(
              tokens.accessToken,
              tokens.refreshToken,
              tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined
            )
            await this.socialAccountRepository.update(account)
          } catch (refreshError) {
            console.error(`Erro ao atualizar token: ${refreshError}`)
            // Continuar tentando publicar com token atual
          }
        }

        // Obter provider e publicar
        const provider = SocialProviderFactory.create(account.platform)

        const publishResult = await provider.publishVideo(
          account.pageAccessToken || account.accessToken,
          videoCut.videoUrl!,
          {
            caption: post.caption || '',
            hashtags: post.hashtags,
          },
          account.pageId
        )

        if (publishResult.success) {
          // Sucesso
          post.markAsPublished(publishResult.postId!, publishResult.postUrl)
          await this.scheduledPostRepository.update(post)

          // Atualizar conta como usada
          account.markAsUsed()
          await this.socialAccountRepository.update(account)

          // Log de sucesso
          await this.publicationLogRepository.save(
            PublicationLog.create({
              scheduledPostId: post.id,
              videoCutId: post.videoCutId,
              socialAccountId: post.socialAccountId,
              campaignId: post.campaignId,
              action: 'published',
              platform: post.platform,
              details: {
                postId: publishResult.postId,
                postUrl: publishResult.postUrl,
                processedAt: new Date().toISOString(),
              },
            })
          )

          result.published++

          // Verificar se todas as publicações do vídeo foram feitas
          await this.checkAndUpdateVideoCutStatus(post.videoCutId)
        } else {
          throw new Error(publishResult.error || 'Falha na publicação')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'

        // Log de erro
        await this.publicationLogRepository.save(
          PublicationLog.create({
            scheduledPostId: post.id,
            videoCutId: post.videoCutId,
            socialAccountId: post.socialAccountId,
            campaignId: post.campaignId,
            action: 'failed',
            platform: post.platform,
            details: {
              error: errorMessage,
              retryCount: post.retryCount,
            },
          })
        )

        // Verificar se pode tentar novamente
        if (post.canRetry()) {
          post.incrementRetry()
          await this.scheduledPostRepository.update(post)

          // Log de retry
          await this.publicationLogRepository.save(
            PublicationLog.create({
              scheduledPostId: post.id,
              videoCutId: post.videoCutId,
              socialAccountId: post.socialAccountId,
              campaignId: post.campaignId,
              action: 'retried',
              platform: post.platform,
              details: {
                retryCount: post.retryCount,
                nextAttempt: 'immediate',
              },
            })
          )

          result.retried++
        } else {
          // Marcar como falha permanente
          post.markAsFailed(errorMessage)
          await this.scheduledPostRepository.update(post)

          result.failed++
          result.errors.push({
            postId: post.id!,
            error: errorMessage,
          })
        }
      }
    }

    return result
  }

  private async checkAndUpdateVideoCutStatus(videoCutId: string): Promise<void> {
    const allPosts = await this.scheduledPostRepository.findByVideoCutId(videoCutId)

    // Verificar se todos os posts foram publicados ou falharam
    const allCompleted = allPosts.every(
      p => p.status === 'published' || p.status === 'failed' || p.status === 'cancelled'
    )

    if (allCompleted) {
      const hasPublished = allPosts.some(p => p.status === 'published')

      if (hasPublished) {
        const videoCut = await this.videoCutRepository.findById(videoCutId)
        if (videoCut && videoCut.status !== 'published') {
          videoCut.markAsPublished()
          await this.videoCutRepository.update(videoCut)
        }
      }
    }
  }
}

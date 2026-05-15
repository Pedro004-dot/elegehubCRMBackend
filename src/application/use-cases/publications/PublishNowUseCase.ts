import { ISocialAccountRepository } from '../../../domain/repositories/ISocialAccountRepository.js'
import { IVideoCutRepository } from '../../../domain/repositories/IVideoCutRepository.js'
import { IScheduledPostRepository } from '../../../domain/repositories/IScheduledPostRepository.js'
import { IPublicationLogRepository } from '../../../domain/repositories/IPublicationLogRepository.js'
import { ScheduledPost } from '../../../domain/entities/ScheduledPost.js'
import { PublicationLog } from '../../../domain/entities/PublicationLog.js'
import { SocialProviderFactory } from '../../../infrastructure/providers/social/SocialProviderFactory.js'
import {
  VideoCutNotFoundError,
  VideoCutNotReadyError,
  NoSocialAccountsSelectedError,
  PublicationFailedError,
} from '../../../domain/errors/PublicationErrors.js'
import {
  SocialAccountNotFoundError,
  SocialAccountTokenExpiredError,
} from '../../../domain/errors/SocialAccountErrors.js'

export interface PublishNowInput {
  videoCutId: string
  socialAccountIds: string[]
  campaignId: string
  userId: string
  caption?: string
  hashtags?: string[]
  ipAddress?: string
  userAgent?: string
}

export interface PublishResult {
  accountId: string
  platform: string
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

export interface PublishNowOutput {
  results: PublishResult[]
  allSucceeded: boolean
}

export class PublishNowUseCase {
  constructor(
    private socialAccountRepository: ISocialAccountRepository,
    private videoCutRepository: IVideoCutRepository,
    private scheduledPostRepository: IScheduledPostRepository,
    private publicationLogRepository: IPublicationLogRepository
  ) {}

  async execute(input: PublishNowInput): Promise<PublishNowOutput> {
    const {
      videoCutId,
      socialAccountIds,
      campaignId,
      userId,
      caption,
      hashtags,
      ipAddress,
      userAgent,
    } = input

    // Validar se há contas selecionadas
    if (!socialAccountIds || socialAccountIds.length === 0) {
      throw new NoSocialAccountsSelectedError()
    }

    // Buscar vídeo
    const videoCut = await this.videoCutRepository.findById(videoCutId)
    if (!videoCut) {
      throw new VideoCutNotFoundError(videoCutId)
    }

    // Verificar se está pronto para publicação
    if (!videoCut.canBePublished()) {
      throw new VideoCutNotReadyError(videoCutId)
    }

    const results: PublishResult[] = []

    for (const accountId of socialAccountIds) {
      const account = await this.socialAccountRepository.findById(accountId)

      if (!account) {
        results.push({
          accountId,
          platform: 'unknown',
          success: false,
          error: 'Conta não encontrada',
        })
        continue
      }

      // Verificar se token está expirado
      if (account.isTokenExpired()) {
        results.push({
          accountId,
          platform: account.platform,
          success: false,
          error: 'Token expirado. Por favor, reconecte a conta.',
        })
        continue
      }

      try {
        // Obter provider
        const provider = SocialProviderFactory.create(account.platform)

        // Publicar
        const finalCaption = caption || videoCut.suggestedCaption || ''
        const finalHashtags = hashtags || videoCut.suggestedHashtags

        const publishResult = await provider.publishVideo(
          account.pageAccessToken || account.accessToken,
          videoCut.videoUrl!,
          {
            caption: finalCaption,
            hashtags: finalHashtags,
          },
          account.pageId
        )

        if (publishResult.success) {
          // Criar registro de post (já publicado)
          const post = ScheduledPost.create({
            videoCutId,
            socialAccountId: accountId,
            campaignId,
            platform: account.platform,
            caption: finalCaption,
            hashtags: finalHashtags,
            scheduledFor: new Date(),
          })
          post.markAsPublished(publishResult.postId!, publishResult.postUrl)

          await this.scheduledPostRepository.save(post)

          // Marcar conta como usada
          account.markAsUsed()
          await this.socialAccountRepository.update(account)

          // Log de sucesso
          await this.publicationLogRepository.save(
            PublicationLog.create({
              scheduledPostId: post.id,
              videoCutId,
              socialAccountId: accountId,
              campaignId,
              userId,
              action: 'published',
              platform: account.platform,
              details: {
                postId: publishResult.postId,
                postUrl: publishResult.postUrl,
              },
              ipAddress,
              userAgent,
            })
          )

          results.push({
            accountId,
            platform: account.platform,
            success: true,
            postId: publishResult.postId,
            postUrl: publishResult.postUrl,
          })
        } else {
          // Log de falha
          await this.publicationLogRepository.save(
            PublicationLog.create({
              videoCutId,
              socialAccountId: accountId,
              campaignId,
              userId,
              action: 'failed',
              platform: account.platform,
              details: {
                error: publishResult.error,
                errorCode: publishResult.errorCode,
              },
              ipAddress,
              userAgent,
            })
          )

          results.push({
            accountId,
            platform: account.platform,
            success: false,
            error: publishResult.error,
          })
        }
      } catch (error) {
        // Log de erro
        await this.publicationLogRepository.save(
          PublicationLog.create({
            videoCutId,
            socialAccountId: accountId,
            campaignId,
            userId,
            action: 'failed',
            platform: account.platform,
            details: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            ipAddress,
            userAgent,
          })
        )

        results.push({
          accountId,
          platform: account.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      }
    }

    // Se todas as publicações foram bem-sucedidas, atualizar status do vídeo
    const allSucceeded = results.every(r => r.success)
    if (allSucceeded && results.length > 0) {
      videoCut.markAsPublished()
      await this.videoCutRepository.update(videoCut)
    }

    return { results, allSucceeded }
  }
}

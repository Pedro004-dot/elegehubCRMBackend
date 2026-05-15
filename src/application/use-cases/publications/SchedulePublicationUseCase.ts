import { ISocialAccountRepository } from '../../../domain/repositories/ISocialAccountRepository.js'
import { IVideoCutRepository } from '../../../domain/repositories/IVideoCutRepository.js'
import { IScheduledPostRepository } from '../../../domain/repositories/IScheduledPostRepository.js'
import { IPublicationLogRepository } from '../../../domain/repositories/IPublicationLogRepository.js'
import { ScheduledPost } from '../../../domain/entities/ScheduledPost.js'
import { PublicationLog } from '../../../domain/entities/PublicationLog.js'
import {
  VideoCutNotFoundError,
  VideoCutNotReadyError,
  InvalidScheduleTimeError,
  NoSocialAccountsSelectedError,
} from '../../../domain/errors/PublicationErrors.js'
import { SocialAccountNotFoundError } from '../../../domain/errors/SocialAccountErrors.js'

export interface SchedulePublicationInput {
  videoCutId: string
  socialAccountIds: string[]
  campaignId: string
  userId: string
  caption?: string
  hashtags?: string[]
  scheduledFor: Date
  ipAddress?: string
  userAgent?: string
}

export interface SchedulePublicationOutput {
  scheduledPosts: ScheduledPost[]
}

export class SchedulePublicationUseCase {
  constructor(
    private socialAccountRepository: ISocialAccountRepository,
    private videoCutRepository: IVideoCutRepository,
    private scheduledPostRepository: IScheduledPostRepository,
    private publicationLogRepository: IPublicationLogRepository
  ) {}

  async execute(input: SchedulePublicationInput): Promise<SchedulePublicationOutput> {
    const {
      videoCutId,
      socialAccountIds,
      campaignId,
      userId,
      caption,
      hashtags,
      scheduledFor,
      ipAddress,
      userAgent,
    } = input

    // Validar data de agendamento
    if (scheduledFor <= new Date()) {
      throw new InvalidScheduleTimeError('A data de agendamento deve ser futura')
    }

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

    // Criar posts agendados
    const scheduledPosts: ScheduledPost[] = []

    for (const accountId of socialAccountIds) {
      const account = await this.socialAccountRepository.findById(accountId)

      if (!account) {
        throw new SocialAccountNotFoundError(accountId)
      }

      // Verificar se pertence à mesma campanha
      if (account.campaignId !== campaignId) {
        throw new Error('Conta social não pertence a esta campanha')
      }

      // Criar post agendado
      const post = ScheduledPost.create({
        videoCutId,
        socialAccountId: accountId,
        campaignId,
        platform: account.platform,
        caption: caption || videoCut.suggestedCaption,
        hashtags: hashtags || videoCut.suggestedHashtags,
        scheduledFor,
      })

      const savedPost = await this.scheduledPostRepository.save(post)
      scheduledPosts.push(savedPost)

      // Criar log de auditoria
      const log = PublicationLog.create({
        scheduledPostId: savedPost.id,
        videoCutId,
        socialAccountId: accountId,
        campaignId,
        userId,
        action: 'scheduled',
        platform: account.platform,
        details: {
          scheduledFor: scheduledFor.toISOString(),
          caption,
          hashtags,
        },
        ipAddress,
        userAgent,
      })

      await this.publicationLogRepository.save(log)
    }

    return { scheduledPosts }
  }
}

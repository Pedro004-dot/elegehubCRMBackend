import { IScheduledPostRepository } from '../../../domain/repositories/IScheduledPostRepository.js'
import { IPublicationLogRepository } from '../../../domain/repositories/IPublicationLogRepository.js'
import { PublicationLog } from '../../../domain/entities/PublicationLog.js'
import { ScheduledPostNotFoundError } from '../../../domain/errors/PublicationErrors.js'

export interface CancelScheduledPostInput {
  postId: string
  campaignId: string
  userId?: string
  ipAddress?: string
  userAgent?: string
}

export class CancelScheduledPostUseCase {
  constructor(
    private scheduledPostRepository: IScheduledPostRepository,
    private publicationLogRepository: IPublicationLogRepository
  ) {}

  async execute(input: CancelScheduledPostInput): Promise<void> {
    const { postId, campaignId, userId, ipAddress, userAgent } = input

    const post = await this.scheduledPostRepository.findById(postId)

    if (!post) {
      throw new ScheduledPostNotFoundError(postId)
    }

    // Verificar se pertence à campanha
    if (post.campaignId !== campaignId) {
      throw new Error('Publicação não pertence a esta campanha')
    }

    // Cancelar
    post.cancel()
    await this.scheduledPostRepository.update(post)

    // Log de cancelamento
    await this.publicationLogRepository.save(
      PublicationLog.create({
        scheduledPostId: postId,
        videoCutId: post.videoCutId,
        socialAccountId: post.socialAccountId,
        campaignId,
        userId,
        action: 'cancelled',
        platform: post.platform,
        details: {
          cancelledAt: new Date().toISOString(),
          originalScheduledFor: post.scheduledFor.toISOString(),
        },
        ipAddress,
        userAgent,
      })
    )
  }
}

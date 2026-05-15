import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { SchedulePublicationUseCase } from '../../../application/use-cases/publications/SchedulePublicationUseCase.js'
import { PublishNowUseCase } from '../../../application/use-cases/publications/PublishNowUseCase.js'
import { ListScheduledPostsUseCase } from '../../../application/use-cases/publications/ListScheduledPostsUseCase.js'
import { CancelScheduledPostUseCase } from '../../../application/use-cases/publications/CancelScheduledPostUseCase.js'
import { SupabaseSocialAccountRepository } from '../../database/repositories/SupabaseSocialAccountRepository.js'
import { SupabaseVideoCutRepository } from '../../database/repositories/SupabaseVideoCutRepository.js'
import { SupabaseScheduledPostRepository } from '../../database/repositories/SupabaseScheduledPostRepository.js'
import { SupabasePublicationLogRepository } from '../../database/repositories/SupabasePublicationLogRepository.js'

const scheduleSchema = z.object({
  videoCutId: z.string().uuid(),
  socialAccountIds: z.array(z.string().uuid()).min(1),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  scheduledFor: z.string().datetime(),
})

const publishNowSchema = z.object({
  videoCutId: z.string().uuid(),
  socialAccountIds: z.array(z.string().uuid()).min(1),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
})

const listSchema = z.object({
  status: z.array(z.enum(['pending', 'processing', 'published', 'failed', 'cancelled'])).optional(),
  platform: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  perPage: z.coerce.number().int().positive().max(100).optional().default(20),
})

export class PublicationsController {
  async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId
      const campaignId = req.params.campaignId || req.body.campaignId
      const input = scheduleSchema.parse(req.body)

      const useCase = new SchedulePublicationUseCase(
        new SupabaseSocialAccountRepository(),
        new SupabaseVideoCutRepository(),
        new SupabaseScheduledPostRepository(),
        new SupabasePublicationLogRepository()
      )

      const result = await useCase.execute({
        ...input,
        campaignId,
        userId,
        scheduledFor: new Date(input.scheduledFor),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      })

      res.status(201).json({
        success: true,
        data: result.scheduledPosts.map(post => ({
          id: post.id,
          platform: post.platform,
          scheduledFor: post.scheduledFor,
          status: post.status,
        })),
      })
    } catch (error) {
      next(error)
    }
  }

  async publishNow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId
      const campaignId = req.params.campaignId || req.body.campaignId
      const input = publishNowSchema.parse(req.body)

      const useCase = new PublishNowUseCase(
        new SupabaseSocialAccountRepository(),
        new SupabaseVideoCutRepository(),
        new SupabaseScheduledPostRepository(),
        new SupabasePublicationLogRepository()
      )

      const result = await useCase.execute({
        ...input,
        campaignId,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      })

      res.json({
        success: true,
        data: {
          results: result.results,
          allSucceeded: result.allSucceeded,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  async listScheduled(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaignId = req.params.campaignId as string
      const query = listSchema.parse(req.query)

      const useCase = new ListScheduledPostsUseCase(
        new SupabaseScheduledPostRepository()
      )

      const result = await useCase.execute({
        campaignId,
        filters: {
          status: query.status,
          platform: query.platform,
        },
        pagination: {
          page: query.page,
          perPage: query.perPage,
        },
      })

      res.json({
        success: true,
        data: result.data,
        meta: {
          page: result.page,
          perPage: result.perPage,
          total: result.total,
          totalPages: result.totalPages,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaignId = req.params.campaignId as string
      const id = req.params.id as string
      const userId = (req as any).userId as string | undefined

      const useCase = new CancelScheduledPostUseCase(
        new SupabaseScheduledPostRepository(),
        new SupabasePublicationLogRepository()
      )

      await useCase.execute({
        postId: id,
        campaignId,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      })

      res.json({
        success: true,
        message: 'Publicação cancelada com sucesso',
      })
    } catch (error) {
      next(error)
    }
  }
}

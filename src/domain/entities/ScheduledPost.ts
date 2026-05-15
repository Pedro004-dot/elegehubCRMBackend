import { SocialPlatform } from './SocialAccount.js'

export type ScheduledPostStatus = 'pending' | 'processing' | 'published' | 'failed' | 'cancelled'

export interface ScheduledPostProps {
  id?: string
  videoCutId: string
  socialAccountId: string
  campaignId: string
  platform: SocialPlatform
  caption?: string
  hashtags?: string[]
  scheduledFor: Date
  status: ScheduledPostStatus
  platformPostId?: string
  platformPostUrl?: string
  errorMessage?: string
  retryCount: number
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export class ScheduledPost {
  private static readonly MAX_RETRIES = 3

  private constructor(private props: ScheduledPostProps) {}

  static create(props: Omit<ScheduledPostProps, 'status' | 'retryCount' | 'createdAt' | 'updatedAt'> & Partial<Pick<ScheduledPostProps, 'status' | 'retryCount' | 'createdAt' | 'updatedAt'>>): ScheduledPost {
    return new ScheduledPost({
      ...props,
      status: props.status ?? 'pending',
      retryCount: props.retryCount ?? 0,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    })
  }

  get id(): string | undefined {
    return this.props.id
  }

  get videoCutId(): string {
    return this.props.videoCutId
  }

  get socialAccountId(): string {
    return this.props.socialAccountId
  }

  get campaignId(): string {
    return this.props.campaignId
  }

  get platform(): SocialPlatform {
    return this.props.platform
  }

  get caption(): string | undefined {
    return this.props.caption
  }

  get hashtags(): string[] | undefined {
    return this.props.hashtags
  }

  get scheduledFor(): Date {
    return this.props.scheduledFor
  }

  get status(): ScheduledPostStatus {
    return this.props.status
  }

  get platformPostId(): string | undefined {
    return this.props.platformPostId
  }

  get platformPostUrl(): string | undefined {
    return this.props.platformPostUrl
  }

  get errorMessage(): string | undefined {
    return this.props.errorMessage
  }

  get retryCount(): number {
    return this.props.retryCount
  }

  get publishedAt(): Date | undefined {
    return this.props.publishedAt
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  isDue(): boolean {
    return this.props.status === 'pending' && new Date() >= this.props.scheduledFor
  }

  canRetry(): boolean {
    return this.props.retryCount < ScheduledPost.MAX_RETRIES
  }

  startProcessing(): void {
    if (this.props.status !== 'pending') {
      throw new Error('Apenas posts pendentes podem ser processados')
    }
    this.props.status = 'processing'
    this.props.updatedAt = new Date()
  }

  markAsPublished(platformPostId: string, platformPostUrl?: string): void {
    this.props.status = 'published'
    this.props.platformPostId = platformPostId
    this.props.platformPostUrl = platformPostUrl
    this.props.publishedAt = new Date()
    this.props.updatedAt = new Date()
  }

  markAsFailed(errorMessage: string): void {
    this.props.status = 'failed'
    this.props.errorMessage = errorMessage
    this.props.updatedAt = new Date()
  }

  incrementRetry(): void {
    this.props.retryCount += 1
    this.props.status = 'pending' // Volta para pending para tentar novamente
    this.props.updatedAt = new Date()
  }

  cancel(): void {
    if (this.props.status === 'published') {
      throw new Error('Posts já publicados não podem ser cancelados')
    }
    this.props.status = 'cancelled'
    this.props.updatedAt = new Date()
  }

  reschedule(newDate: Date): void {
    if (this.props.status === 'published') {
      throw new Error('Posts já publicados não podem ser reagendados')
    }
    if (newDate <= new Date()) {
      throw new Error('A nova data deve ser futura')
    }
    this.props.scheduledFor = newDate
    this.props.status = 'pending'
    this.props.errorMessage = undefined
    this.props.retryCount = 0
    this.props.updatedAt = new Date()
  }

  toJSON(): ScheduledPostProps {
    return { ...this.props }
  }
}

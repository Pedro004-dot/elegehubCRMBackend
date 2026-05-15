import { SocialPlatform } from './SocialAccount.js'

export type PublicationAction = 'scheduled' | 'published' | 'failed' | 'cancelled' | 'retried'

export interface PublicationLogProps {
  id?: string
  scheduledPostId?: string
  videoCutId: string
  socialAccountId: string
  campaignId: string
  userId?: string
  action: PublicationAction
  platform: SocialPlatform
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export class PublicationLog {
  private constructor(private props: PublicationLogProps) {}

  static create(props: Omit<PublicationLogProps, 'createdAt'> & Partial<Pick<PublicationLogProps, 'createdAt'>>): PublicationLog {
    return new PublicationLog({
      ...props,
      createdAt: props.createdAt ?? new Date(),
    })
  }

  get id(): string | undefined {
    return this.props.id
  }

  get scheduledPostId(): string | undefined {
    return this.props.scheduledPostId
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

  get userId(): string | undefined {
    return this.props.userId
  }

  get action(): PublicationAction {
    return this.props.action
  }

  get platform(): SocialPlatform {
    return this.props.platform
  }

  get details(): Record<string, unknown> | undefined {
    return this.props.details
  }

  get ipAddress(): string | undefined {
    return this.props.ipAddress
  }

  get userAgent(): string | undefined {
    return this.props.userAgent
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  toJSON(): PublicationLogProps {
    return { ...this.props }
  }
}

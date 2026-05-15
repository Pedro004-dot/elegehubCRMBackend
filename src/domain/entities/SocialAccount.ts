export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'youtube'

export interface SocialAccountProps {
  id?: string
  userId: string
  campaignId: string
  platform: SocialPlatform
  platformUserId: string
  platformUsername?: string
  platformName?: string
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: Date
  pageId?: string
  pageName?: string
  pageAccessToken?: string
  profilePictureUrl?: string
  scopes?: string[]
  isActive: boolean
  connectedAt: Date
  lastUsedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export class SocialAccount {
  private constructor(private props: SocialAccountProps) {}

  static create(props: Omit<SocialAccountProps, 'isActive' | 'connectedAt' | 'createdAt' | 'updatedAt'> & Partial<Pick<SocialAccountProps, 'isActive' | 'connectedAt' | 'createdAt' | 'updatedAt'>>): SocialAccount {
    return new SocialAccount({
      ...props,
      isActive: props.isActive ?? true,
      connectedAt: props.connectedAt ?? new Date(),
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    })
  }

  get id(): string | undefined {
    return this.props.id
  }

  get userId(): string {
    return this.props.userId
  }

  get campaignId(): string {
    return this.props.campaignId
  }

  get platform(): SocialPlatform {
    return this.props.platform
  }

  get platformUserId(): string {
    return this.props.platformUserId
  }

  get platformUsername(): string | undefined {
    return this.props.platformUsername
  }

  get platformName(): string | undefined {
    return this.props.platformName
  }

  get accessToken(): string {
    return this.props.accessToken
  }

  get refreshToken(): string | undefined {
    return this.props.refreshToken
  }

  get tokenExpiresAt(): Date | undefined {
    return this.props.tokenExpiresAt
  }

  get pageId(): string | undefined {
    return this.props.pageId
  }

  get pageName(): string | undefined {
    return this.props.pageName
  }

  get pageAccessToken(): string | undefined {
    return this.props.pageAccessToken
  }

  get profilePictureUrl(): string | undefined {
    return this.props.profilePictureUrl
  }

  get scopes(): string[] | undefined {
    return this.props.scopes
  }

  get isActive(): boolean {
    return this.props.isActive
  }

  get connectedAt(): Date {
    return this.props.connectedAt
  }

  get lastUsedAt(): Date | undefined {
    return this.props.lastUsedAt
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  isTokenExpired(): boolean {
    if (!this.props.tokenExpiresAt) return false
    return new Date() >= this.props.tokenExpiresAt
  }

  needsTokenRefresh(): boolean {
    if (!this.props.tokenExpiresAt) return false
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000)
    return thirtyMinutesFromNow >= this.props.tokenExpiresAt
  }

  updateTokens(accessToken: string, refreshToken?: string, expiresAt?: Date): void {
    this.props.accessToken = accessToken
    if (refreshToken) this.props.refreshToken = refreshToken
    if (expiresAt) this.props.tokenExpiresAt = expiresAt
    this.props.updatedAt = new Date()
  }

  markAsUsed(): void {
    this.props.lastUsedAt = new Date()
  }

  deactivate(): void {
    this.props.isActive = false
    this.props.updatedAt = new Date()
  }

  toJSON(): SocialAccountProps {
    return { ...this.props }
  }
}

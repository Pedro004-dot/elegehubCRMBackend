import { SocialPlatform } from '../../../domain/entities/SocialAccount.js'

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number // em segundos
  scope?: string[]
  tokenType?: string
}

export interface UserProfile {
  id: string
  username?: string
  name?: string
  profilePictureUrl?: string
  email?: string
  pages?: PageInfo[] // Para Facebook/Instagram
}

export interface PageInfo {
  id: string
  name: string
  accessToken: string
  category?: string
  instagramAccountId?: string // Para Instagram Business
}

export interface PublishResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
  errorCode?: string
}

export interface UploadSession {
  uploadUrl: string
  sessionId?: string
  expiresAt?: Date
}

export interface VideoUploadOptions {
  caption: string
  hashtags?: string[]
  thumbnailUrl?: string
  publishNow?: boolean
  scheduledPublishTime?: Date
}

export interface ISocialMediaProvider {
  readonly platform: SocialPlatform

  // OAuth
  getAuthorizationUrl(state: string, redirectUri: string): string
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>
  revokeToken(accessToken: string): Promise<void>

  // User info
  getUserProfile(accessToken: string): Promise<UserProfile>
  getPages(accessToken: string): Promise<PageInfo[]>

  // Publishing
  publishVideo(
    accessToken: string,
    videoUrl: string,
    options: VideoUploadOptions,
    pageId?: string
  ): Promise<PublishResult>

  // Chunked upload para vídeos grandes
  initiateVideoUpload?(
    accessToken: string,
    videoSize: number,
    pageId?: string
  ): Promise<UploadSession>

  uploadVideoChunk?(
    uploadUrl: string,
    chunk: Buffer,
    offset: number,
    totalSize: number
  ): Promise<void>

  finalizeVideoUpload?(
    accessToken: string,
    sessionId: string,
    options: VideoUploadOptions,
    pageId?: string
  ): Promise<PublishResult>

  // Status
  getPostStatus?(accessToken: string, postId: string): Promise<{
    status: string
    url?: string
    views?: number
    likes?: number
    comments?: number
  }>
}

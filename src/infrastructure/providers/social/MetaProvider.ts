import {
  ISocialMediaProvider,
  OAuthTokens,
  UserProfile,
  PageInfo,
  PublishResult,
  VideoUploadOptions,
} from './ISocialMediaProvider.js'
import { SocialPlatform } from '../../../domain/entities/SocialAccount.js'

interface MetaProviderConfig {
  appId: string
  appSecret: string
  platform: 'facebook' | 'instagram'
}

export class MetaProvider implements ISocialMediaProvider {
  readonly platform: SocialPlatform
  private readonly baseUrl = 'https://graph.facebook.com/v18.0'
  private readonly appId: string
  private readonly appSecret: string

  constructor(config: MetaProviderConfig) {
    this.appId = config.appId
    this.appSecret = config.appSecret
    this.platform = config.platform
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const scopes = this.platform === 'instagram'
      ? [
          'instagram_basic',
          'instagram_content_publish',
          'pages_show_list',
          'pages_read_engagement',
          'business_management',
        ]
      : [
          'pages_manage_posts',
          'pages_read_engagement',
          'pages_show_list',
          'pages_manage_metadata',
        ]

    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      state,
      response_type: 'code',
    })

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    // Trocar código por short-lived token
    const tokenUrl = `${this.baseUrl}/oauth/access_token`
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    })

    const response = await fetch(`${tokenUrl}?${params.toString()}`)
    const data = await response.json()

    if (data.error) {
      throw new Error(`OAuth error: ${data.error.message}`)
    }

    // Trocar por long-lived token (60 dias para páginas)
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: data.access_token,
    })

    const longLivedResponse = await fetch(`${tokenUrl}?${longLivedParams.toString()}`)
    const longLivedData = await longLivedResponse.json()

    if (longLivedData.error) {
      throw new Error(`Token exchange error: ${longLivedData.error.message}`)
    }

    return {
      accessToken: longLivedData.access_token,
      expiresIn: longLivedData.expires_in,
      tokenType: longLivedData.token_type,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    // Meta não usa refresh tokens tradicionais
    // Para long-lived tokens, você precisa trocar novamente antes de expirar
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: refreshToken, // Usar o token atual
    })

    const response = await fetch(`${this.baseUrl}/oauth/access_token?${params.toString()}`)
    const data = await response.json()

    if (data.error) {
      throw new Error(`Token refresh error: ${data.error.message}`)
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/me/permissions`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(`Revoke error: ${data.error?.message || 'Unknown error'}`)
    }
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const fields = 'id,name,email,picture.width(200).height(200)'
    const response = await fetch(
      `${this.baseUrl}/me?fields=${fields}&access_token=${accessToken}`
    )
    const data = await response.json()

    if (data.error) {
      throw new Error(`Profile error: ${data.error.message}`)
    }

    const pages = await this.getPages(accessToken)

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      profilePictureUrl: data.picture?.data?.url,
      pages,
    }
  }

  async getPages(accessToken: string): Promise<PageInfo[]> {
    const response = await fetch(
      `${this.baseUrl}/me/accounts?fields=id,name,access_token,category,instagram_business_account&access_token=${accessToken}`
    )
    const data = await response.json()

    if (data.error) {
      throw new Error(`Pages error: ${data.error.message}`)
    }

    return (data.data || []).map((page: Record<string, unknown>) => ({
      id: page.id as string,
      name: page.name as string,
      accessToken: page.access_token as string,
      category: page.category as string | undefined,
      instagramAccountId: (page.instagram_business_account as Record<string, string> | undefined)?.id,
    }))
  }

  async publishVideo(
    accessToken: string,
    videoUrl: string,
    options: VideoUploadOptions,
    pageId?: string
  ): Promise<PublishResult> {
    if (this.platform === 'instagram') {
      return this.publishInstagramReel(accessToken, videoUrl, options, pageId!)
    }
    return this.publishFacebookVideo(accessToken, videoUrl, options, pageId!)
  }

  private async publishInstagramReel(
    accessToken: string,
    videoUrl: string,
    options: VideoUploadOptions,
    igAccountId: string
  ): Promise<PublishResult> {
    try {
      // 1. Criar container de mídia
      const caption = this.buildCaption(options)
      const containerParams = new URLSearchParams({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: accessToken,
      })

      const containerResponse = await fetch(
        `${this.baseUrl}/${igAccountId}/media?${containerParams.toString()}`,
        { method: 'POST' }
      )
      const containerData = await containerResponse.json()

      if (containerData.error) {
        return {
          success: false,
          error: containerData.error.message,
          errorCode: containerData.error.code,
        }
      }

      const containerId = containerData.id

      // 2. Aguardar processamento do vídeo
      await this.waitForMediaReady(accessToken, containerId)

      // 3. Publicar
      const publishParams = new URLSearchParams({
        creation_id: containerId,
        access_token: accessToken,
      })

      const publishResponse = await fetch(
        `${this.baseUrl}/${igAccountId}/media_publish?${publishParams.toString()}`,
        { method: 'POST' }
      )
      const publishData = await publishResponse.json()

      if (publishData.error) {
        return {
          success: false,
          error: publishData.error.message,
          errorCode: publishData.error.code,
        }
      }

      return {
        success: true,
        postId: publishData.id,
        postUrl: `https://www.instagram.com/reel/${publishData.id}/`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async publishFacebookVideo(
    accessToken: string,
    videoUrl: string,
    options: VideoUploadOptions,
    pageId: string
  ): Promise<PublishResult> {
    try {
      const caption = this.buildCaption(options)

      const formData = new FormData()
      formData.append('file_url', videoUrl)
      formData.append('description', caption)
      formData.append('access_token', accessToken)

      if (options.scheduledPublishTime) {
        formData.append('scheduled_publish_time', Math.floor(options.scheduledPublishTime.getTime() / 1000).toString())
        formData.append('published', 'false')
      }

      const response = await fetch(`${this.baseUrl}/${pageId}/videos`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()

      if (data.error) {
        return {
          success: false,
          error: data.error.message,
          errorCode: data.error.code,
        }
      }

      return {
        success: true,
        postId: data.id,
        postUrl: `https://www.facebook.com/${pageId}/videos/${data.id}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async waitForMediaReady(accessToken: string, containerId: string): Promise<void> {
    const maxAttempts = 30
    const delayMs = 2000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(
        `${this.baseUrl}/${containerId}?fields=status_code&access_token=${accessToken}`
      )
      const data = await response.json()

      if (data.status_code === 'FINISHED') {
        return
      }

      if (data.status_code === 'ERROR') {
        throw new Error('Processamento do vídeo falhou')
      }

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    throw new Error('Timeout aguardando processamento do vídeo')
  }

  private buildCaption(options: VideoUploadOptions): string {
    let caption = options.caption || ''

    if (options.hashtags && options.hashtags.length > 0) {
      const hashtagsText = options.hashtags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ')
      caption = `${caption}\n\n${hashtagsText}`
    }

    return caption.trim()
  }

  async getPostStatus(accessToken: string, postId: string): Promise<{
    status: string
    url?: string
    views?: number
    likes?: number
    comments?: number
  }> {
    const fields = this.platform === 'instagram'
      ? 'id,permalink,like_count,comments_count'
      : 'id,permalink_url,likes.summary(true),comments.summary(true)'

    const response = await fetch(
      `${this.baseUrl}/${postId}?fields=${fields}&access_token=${accessToken}`
    )
    const data = await response.json()

    if (data.error) {
      throw new Error(`Status error: ${data.error.message}`)
    }

    if (this.platform === 'instagram') {
      return {
        status: 'published',
        url: data.permalink,
        likes: data.like_count,
        comments: data.comments_count,
      }
    }

    return {
      status: 'published',
      url: data.permalink_url,
      likes: data.likes?.summary?.total_count,
      comments: data.comments?.summary?.total_count,
    }
  }
}

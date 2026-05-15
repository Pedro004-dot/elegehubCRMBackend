import {
  ISocialMediaProvider,
  OAuthTokens,
  UserProfile,
  PageInfo,
  PublishResult,
  VideoUploadOptions,
  UploadSession,
} from './ISocialMediaProvider.js'
import { SocialPlatform } from '../../../domain/entities/SocialAccount.js'

interface TikTokProviderConfig {
  clientKey: string
  clientSecret: string
}

export class TikTokProvider implements ISocialMediaProvider {
  readonly platform: SocialPlatform = 'tiktok'
  private readonly authUrl = 'https://www.tiktok.com/v2/auth/authorize'
  private readonly apiUrl = 'https://open.tiktokapis.com/v2'
  private readonly clientKey: string
  private readonly clientSecret: string

  constructor(config: TikTokProviderConfig) {
    this.clientKey = config.clientKey
    this.clientSecret = config.clientSecret
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const scopes = [
      'user.info.basic',
      'video.publish',
      'video.upload',
    ]

    const params = new URLSearchParams({
      client_key: this.clientKey,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      state,
      response_type: 'code',
    })

    return `${this.authUrl}/?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(`${this.apiUrl}/oauth/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(`OAuth error: ${data.error_description || data.error}`)
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope?.split(','),
      tokenType: data.token_type,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(`${this.apiUrl}/oauth/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(`Token refresh error: ${data.error_description || data.error}`)
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/oauth/revoke/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        token: accessToken,
      }),
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(`Revoke error: ${data.error_description || data.error}`)
    }
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(`${this.apiUrl}/user/info/?fields=open_id,union_id,avatar_url,display_name`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const data = await response.json()

    if (data.error?.code !== 'ok') {
      throw new Error(`Profile error: ${data.error?.message || 'Unknown error'}`)
    }

    const user = data.data?.user

    return {
      id: user.open_id,
      username: user.display_name,
      name: user.display_name,
      profilePictureUrl: user.avatar_url,
    }
  }

  async getPages(): Promise<PageInfo[]> {
    // TikTok não tem conceito de páginas
    return []
  }

  async publishVideo(
    accessToken: string,
    videoUrl: string,
    options: VideoUploadOptions
  ): Promise<PublishResult> {
    try {
      // TikTok usa um processo de upload em 2 etapas:
      // 1. Iniciar upload e obter upload_url
      // 2. Fazer POST do vídeo para a upload_url
      // 3. Publicar

      // 1. Iniciar sessão de upload
      const initResponse = await fetch(`${this.apiUrl}/post/publish/video/init/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: options.caption || '',
            privacy_level: 'SELF_ONLY', // Começar como privado, depois pode mudar
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl,
          },
        }),
      })

      const initData = await initResponse.json()

      if (initData.error?.code !== 'ok') {
        return {
          success: false,
          error: initData.error?.message || 'Falha ao iniciar upload',
          errorCode: initData.error?.code,
        }
      }

      const publishId = initData.data?.publish_id

      // 2. Verificar status do upload (polling)
      const status = await this.waitForPublishComplete(accessToken, publishId)

      if (status.status === 'FAILED') {
        return {
          success: false,
          error: status.fail_reason || 'Publicação falhou',
        }
      }

      return {
        success: true,
        postId: publishId,
        // TikTok não retorna URL diretamente no publish
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async initiateVideoUpload(
    accessToken: string,
    videoSize: number
  ): Promise<UploadSession> {
    // Para uploads maiores, usar chunked upload
    const response = await fetch(`${this.apiUrl}/post/publish/inbox/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: 10 * 1024 * 1024, // 10MB chunks
          total_chunk_count: Math.ceil(videoSize / (10 * 1024 * 1024)),
        },
      }),
    })

    const data = await response.json()

    if (data.error?.code !== 'ok') {
      throw new Error(`Upload init error: ${data.error?.message}`)
    }

    return {
      uploadUrl: data.data?.upload_url,
      sessionId: data.data?.publish_id,
    }
  }

  async uploadVideoChunk(
    uploadUrl: string,
    chunk: Buffer,
    offset: number,
    totalSize: number
  ): Promise<void> {
    const endByte = offset + chunk.length - 1

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${offset}-${endByte}/${totalSize}`,
        'Content-Length': chunk.length.toString(),
      },
      body: new Uint8Array(chunk),
    })

    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.statusText}`)
    }
  }

  async finalizeVideoUpload(
    accessToken: string,
    sessionId: string,
    options: VideoUploadOptions
  ): Promise<PublishResult> {
    // Após todos os chunks, chamar o endpoint de publicação
    const response = await fetch(`${this.apiUrl}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publish_id: sessionId,
      }),
    })

    const data = await response.json()

    if (data.data?.status === 'PUBLISH_COMPLETE') {
      return {
        success: true,
        postId: sessionId,
      }
    }

    return {
      success: false,
      error: data.data?.fail_reason || 'Publicação não completada',
    }
  }

  private async waitForPublishComplete(
    accessToken: string,
    publishId: string
  ): Promise<{ status: string; fail_reason?: string }> {
    const maxAttempts = 30
    const delayMs = 3000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${this.apiUrl}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publish_id: publishId,
        }),
      })

      const data = await response.json()
      const status = data.data?.status

      if (status === 'PUBLISH_COMPLETE') {
        return { status: 'COMPLETE' }
      }

      if (status === 'FAILED') {
        return {
          status: 'FAILED',
          fail_reason: data.data?.fail_reason,
        }
      }

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    return { status: 'TIMEOUT' }
  }

  async getPostStatus(accessToken: string, postId: string): Promise<{
    status: string
    url?: string
    views?: number
    likes?: number
    comments?: number
  }> {
    const response = await fetch(`${this.apiUrl}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publish_id: postId,
      }),
    })

    const data = await response.json()

    return {
      status: data.data?.status || 'unknown',
    }
  }
}

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

interface YouTubeProviderConfig {
  clientId: string
  clientSecret: string
}

export class YouTubeProvider implements ISocialMediaProvider {
  readonly platform: SocialPlatform = 'youtube'
  private readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token'
  private readonly apiUrl = 'https://www.googleapis.com/youtube/v3'
  private readonly uploadUrl = 'https://www.googleapis.com/upload/youtube/v3'
  private readonly clientId: string
  private readonly clientSecret: string

  constructor(config: YouTubeProviderConfig) {
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
    ]

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
      access_type: 'offline', // Para obter refresh token
      prompt: 'consent', // Forçar consent para obter refresh token
    })

    return `${this.authUrl}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
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
      scope: data.scope?.split(' '),
      tokenType: data.token_type,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
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
      refreshToken: refreshToken, // Google não retorna novo refresh token
      expiresIn: data.expires_in,
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(`Revoke error: ${data.error_description || 'Unknown error'}`)
    }
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    // Buscar informações do canal do YouTube
    const channelResponse = await fetch(
      `${this.apiUrl}/channels?part=snippet&mine=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const channelData = await channelResponse.json()

    if (channelData.error) {
      throw new Error(`Profile error: ${channelData.error.message}`)
    }

    const channel = channelData.items?.[0]

    if (!channel) {
      throw new Error('Nenhum canal do YouTube encontrado')
    }

    return {
      id: channel.id,
      username: channel.snippet.customUrl,
      name: channel.snippet.title,
      profilePictureUrl: channel.snippet.thumbnails?.default?.url,
    }
  }

  async getPages(): Promise<PageInfo[]> {
    // YouTube não tem conceito de páginas como Facebook
    return []
  }

  async publishVideo(
    accessToken: string,
    videoUrl: string,
    options: VideoUploadOptions
  ): Promise<PublishResult> {
    try {
      // YouTube requer upload direto do arquivo, não aceita URL
      // Primeiro precisamos baixar o vídeo e depois fazer upload
      // Para simplificar, vamos usar resumable upload

      // 1. Buscar o vídeo da URL
      const videoResponse = await fetch(videoUrl)
      if (!videoResponse.ok) {
        throw new Error('Não foi possível baixar o vídeo')
      }

      const videoBuffer = await videoResponse.arrayBuffer()
      const videoSize = videoBuffer.byteLength

      // 2. Iniciar upload resumível
      const uploadSession = await this.initiateVideoUpload(accessToken, videoSize)

      // 3. Fazer upload do vídeo
      await this.uploadVideoChunk(
        uploadSession.uploadUrl,
        Buffer.from(videoBuffer),
        0,
        videoSize
      )

      // 4. Finalizar com metadados
      return this.finalizeVideoUpload(accessToken, uploadSession.sessionId!, options)
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
    // Para YouTube Shorts, o vídeo deve ter <= 60 segundos e aspect ratio 9:16
    const metadata = {
      snippet: {
        title: 'Vídeo em processamento', // Será atualizado depois
        description: '',
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: 'private', // Começar como privado
        selfDeclaredMadeForKids: false,
      },
    }

    const response = await fetch(
      `${this.uploadUrl}/videos?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': videoSize.toString(),
        },
        body: JSON.stringify(metadata),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Upload init error: ${errorData.error?.message || response.statusText}`)
    }

    const uploadUrl = response.headers.get('Location')

    if (!uploadUrl) {
      throw new Error('Upload URL não retornada')
    }

    return {
      uploadUrl,
      sessionId: uploadUrl, // Usar a própria URL como session ID
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

    // YouTube retorna 308 para chunks parciais, 200/201 para completo
    if (!response.ok && response.status !== 308) {
      const errorData = await response.json()
      throw new Error(`Chunk upload failed: ${errorData.error?.message || response.statusText}`)
    }
  }

  async finalizeVideoUpload(
    accessToken: string,
    uploadUrl: string, // Na verdade é a URL de upload que contém o vídeo ID
    options: VideoUploadOptions
  ): Promise<PublishResult> {
    // Após o upload completo, precisamos atualizar os metadados
    // O uploadUrl já contém o video ID no response do upload

    // Extrair video ID do response anterior ou fazer nova chamada
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': '0',
      },
    })

    if (!response.ok && response.status !== 200) {
      return {
        success: false,
        error: 'Falha ao finalizar upload',
      }
    }

    const data = await response.json()
    const videoId = data.id

    // Atualizar metadados do vídeo
    const title = this.buildTitle(options)
    const description = this.buildDescription(options)

    const updateResponse = await fetch(`${this.apiUrl}/videos?part=snippet,status`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: videoId,
        snippet: {
          title,
          description,
          categoryId: '22',
        },
        status: {
          privacyStatus: 'public', // Tornar público
          selfDeclaredMadeForKids: false,
        },
      }),
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json()
      return {
        success: false,
        error: `Falha ao atualizar metadados: ${errorData.error?.message}`,
      }
    }

    return {
      success: true,
      postId: videoId,
      postUrl: `https://youtube.com/shorts/${videoId}`,
    }
  }

  private buildTitle(options: VideoUploadOptions): string {
    // YouTube Shorts títulos devem ser curtos
    let title = options.caption || 'Vídeo'

    // Limitar a 100 caracteres
    if (title.length > 100) {
      title = title.substring(0, 97) + '...'
    }

    // Adicionar #Shorts para identificar como Short
    if (!title.includes('#Shorts') && !title.includes('#shorts')) {
      // Verificar se cabe
      if (title.length + 8 <= 100) {
        title = `${title} #Shorts`
      }
    }

    return title
  }

  private buildDescription(options: VideoUploadOptions): string {
    let description = options.caption || ''

    if (options.hashtags && options.hashtags.length > 0) {
      const hashtagsText = options.hashtags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ')
      description = `${description}\n\n${hashtagsText}`
    }

    // Adicionar #Shorts se não existir
    if (!description.includes('#Shorts') && !description.includes('#shorts')) {
      description = `${description}\n\n#Shorts`
    }

    return description.trim()
  }

  async getPostStatus(accessToken: string, postId: string): Promise<{
    status: string
    url?: string
    views?: number
    likes?: number
    comments?: number
  }> {
    const response = await fetch(
      `${this.apiUrl}/videos?part=statistics,status&id=${postId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const data = await response.json()

    if (data.error) {
      throw new Error(`Status error: ${data.error.message}`)
    }

    const video = data.items?.[0]

    if (!video) {
      return { status: 'not_found' }
    }

    return {
      status: video.status?.uploadStatus || 'unknown',
      url: `https://youtube.com/shorts/${postId}`,
      views: parseInt(video.statistics?.viewCount || '0', 10),
      likes: parseInt(video.statistics?.likeCount || '0', 10),
      comments: parseInt(video.statistics?.commentCount || '0', 10),
    }
  }
}

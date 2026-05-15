import { SocialPlatform } from '../../../domain/entities/SocialAccount.js'
import { ISocialMediaProvider } from './ISocialMediaProvider.js'
import { MetaProvider } from './MetaProvider.js'
import { TikTokProvider } from './TikTokProvider.js'
import { YouTubeProvider } from './YouTubeProvider.js'
import { env } from '../../config/env.js'

export class SocialProviderFactory {
  private static providers: Map<SocialPlatform, ISocialMediaProvider> = new Map()

  static create(platform: SocialPlatform): ISocialMediaProvider {
    // Retornar instância em cache se existir
    if (this.providers.has(platform)) {
      return this.providers.get(platform)!
    }

    let provider: ISocialMediaProvider

    switch (platform) {
      case 'facebook':
        if (!env.META_APP_ID || !env.META_APP_SECRET) {
          throw new Error('META_APP_ID e META_APP_SECRET são obrigatórios para Facebook')
        }
        provider = new MetaProvider({
          appId: env.META_APP_ID,
          appSecret: env.META_APP_SECRET,
          platform: 'facebook',
        })
        break

      case 'instagram':
        if (!env.META_APP_ID || !env.META_APP_SECRET) {
          throw new Error('META_APP_ID e META_APP_SECRET são obrigatórios para Instagram')
        }
        provider = new MetaProvider({
          appId: env.META_APP_ID,
          appSecret: env.META_APP_SECRET,
          platform: 'instagram',
        })
        break

      case 'tiktok':
        if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
          throw new Error('TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET são obrigatórios para TikTok')
        }
        provider = new TikTokProvider({
          clientKey: env.TIKTOK_CLIENT_KEY,
          clientSecret: env.TIKTOK_CLIENT_SECRET,
        })
        break

      case 'youtube':
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
          throw new Error('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórios para YouTube')
        }
        provider = new YouTubeProvider({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        })
        break

      default:
        throw new Error(`Plataforma não suportada: ${platform}`)
    }

    // Cachear a instância
    this.providers.set(platform, provider)

    return provider
  }

  static getRedirectUri(platform: SocialPlatform): string {
    const baseUrl = env.API_BASE_URL || 'http://localhost:3000'

    switch (platform) {
      case 'facebook':
      case 'instagram':
        return `${baseUrl}/api/v1/social/auth/meta/callback`
      case 'tiktok':
        return `${baseUrl}/api/v1/social/auth/tiktok/callback`
      case 'youtube':
        return `${baseUrl}/api/v1/social/auth/google/callback`
      default:
        throw new Error(`Plataforma não suportada: ${platform}`)
    }
  }

  static clearCache(): void {
    this.providers.clear()
  }
}

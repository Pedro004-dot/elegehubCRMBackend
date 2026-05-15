import { AppError } from '../../shared/errors/AppError.js'

export class SocialAccountNotFoundError extends AppError {
  constructor(id: string) {
    super(`Conta social não encontrada: ${id}`, 404)
    this.name = 'SocialAccountNotFoundError'
  }
}

export class SocialAccountAlreadyExistsError extends AppError {
  constructor(platform: string) {
    super(`Conta do ${platform} já conectada`, 409)
    this.name = 'SocialAccountAlreadyExistsError'
  }
}

export class SocialAccountTokenExpiredError extends AppError {
  constructor(platform: string) {
    super(`Token do ${platform} expirado. Por favor, reconecte a conta.`, 401)
    this.name = 'SocialAccountTokenExpiredError'
  }
}

export class SocialAccountDisabledError extends AppError {
  constructor(platform: string) {
    super(`Conta do ${platform} está desativada`, 403)
    this.name = 'SocialAccountDisabledError'
  }
}

export class OAuthStateInvalidError extends AppError {
  constructor() {
    super('Estado OAuth inválido ou expirado', 400)
    this.name = 'OAuthStateInvalidError'
  }
}

export class OAuthCallbackError extends AppError {
  constructor(message: string) {
    super(`Erro no callback OAuth: ${message}`, 400)
    this.name = 'OAuthCallbackError'
  }
}

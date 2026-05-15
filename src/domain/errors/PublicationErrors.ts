import { AppError } from '../../shared/errors/AppError.js'

export class VideoCutNotFoundError extends AppError {
  constructor(id: string) {
    super(`Corte de vídeo não encontrado: ${id}`, 404)
    this.name = 'VideoCutNotFoundError'
  }
}

export class VideoCutNotReadyError extends AppError {
  constructor(id: string) {
    super(`Corte de vídeo ${id} não está pronto para publicação`, 400)
    this.name = 'VideoCutNotReadyError'
  }
}

export class ScheduledPostNotFoundError extends AppError {
  constructor(id: string) {
    super(`Publicação agendada não encontrada: ${id}`, 404)
    this.name = 'ScheduledPostNotFoundError'
  }
}

export class InvalidScheduleTimeError extends AppError {
  constructor(message: string = 'A data de agendamento deve ser futura') {
    super(message, 400)
    this.name = 'InvalidScheduleTimeError'
  }
}

export class PublicationFailedError extends AppError {
  constructor(platform: string, reason: string) {
    super(`Falha ao publicar no ${platform}: ${reason}`, 500)
    this.name = 'PublicationFailedError'
  }
}

export class NoSocialAccountsSelectedError extends AppError {
  constructor() {
    super('Nenhuma conta social selecionada para publicação', 400)
    this.name = 'NoSocialAccountsSelectedError'
  }
}

export class CampaignNotFoundError extends AppError {
  constructor(id: string) {
    super(`Campanha não encontrada: ${id}`, 404)
    this.name = 'CampaignNotFoundError'
  }
}

export type VideoCutStatus = 'ready' | 'review' | 'published' | 'archived'
export type VideoCutFormat = '9:16' | '16:9' | '1:1'

export interface ChannelRecommendation {
  channel: 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'whatsapp'
  label: string
  adherence: 'high' | 'medium' | 'low'
  adherencePercent: number
}

export interface VideoCutProps {
  id?: string
  campaignId: string
  title: string
  description?: string
  thumbnailUrl?: string
  videoUrl?: string
  storagePath?: string
  duration: number // em segundos
  format: VideoCutFormat
  fileSize?: number
  status: VideoCutStatus
  viralScore?: number
  viralScoreReasons?: string[]
  transcription?: string
  suggestedCaption?: string
  suggestedHashtags?: string[]
  sourceSession?: string
  tags?: string[]
  channelRecommendations?: ChannelRecommendation[]
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
}

export class VideoCut {
  private constructor(private props: VideoCutProps) {}

  static create(props: Omit<VideoCutProps, 'status' | 'createdAt' | 'updatedAt'> & Partial<Pick<VideoCutProps, 'status' | 'createdAt' | 'updatedAt'>>): VideoCut {
    return new VideoCut({
      ...props,
      status: props.status ?? 'review',
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    })
  }

  get id(): string | undefined {
    return this.props.id
  }

  get campaignId(): string {
    return this.props.campaignId
  }

  get title(): string {
    return this.props.title
  }

  get description(): string | undefined {
    return this.props.description
  }

  get thumbnailUrl(): string | undefined {
    return this.props.thumbnailUrl
  }

  get videoUrl(): string | undefined {
    return this.props.videoUrl
  }

  get storagePath(): string | undefined {
    return this.props.storagePath
  }

  get duration(): number {
    return this.props.duration
  }

  get format(): VideoCutFormat {
    return this.props.format
  }

  get fileSize(): number | undefined {
    return this.props.fileSize
  }

  get status(): VideoCutStatus {
    return this.props.status
  }

  get viralScore(): number | undefined {
    return this.props.viralScore
  }

  get viralScoreReasons(): string[] | undefined {
    return this.props.viralScoreReasons
  }

  get transcription(): string | undefined {
    return this.props.transcription
  }

  get suggestedCaption(): string | undefined {
    return this.props.suggestedCaption
  }

  get suggestedHashtags(): string[] | undefined {
    return this.props.suggestedHashtags
  }

  get sourceSession(): string | undefined {
    return this.props.sourceSession
  }

  get tags(): string[] | undefined {
    return this.props.tags
  }

  get channelRecommendations(): ChannelRecommendation[] | undefined {
    return this.props.channelRecommendations
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  get publishedAt(): Date | undefined {
    return this.props.publishedAt
  }

  canBePublished(): boolean {
    return this.props.status === 'ready'
  }

  approve(): void {
    if (this.props.status !== 'review') {
      throw new Error('Apenas cortes em revisão podem ser aprovados')
    }
    this.props.status = 'ready'
    this.props.updatedAt = new Date()
  }

  markAsPublished(): void {
    this.props.status = 'published'
    this.props.publishedAt = new Date()
    this.props.updatedAt = new Date()
  }

  archive(): void {
    this.props.status = 'archived'
    this.props.updatedAt = new Date()
  }

  restore(): void {
    if (this.props.status !== 'archived') {
      throw new Error('Apenas cortes arquivados podem ser restaurados')
    }
    this.props.status = 'ready'
    this.props.updatedAt = new Date()
  }

  updateCaption(caption: string): void {
    this.props.suggestedCaption = caption
    this.props.updatedAt = new Date()
  }

  toJSON(): VideoCutProps {
    return { ...this.props }
  }
}

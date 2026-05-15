export interface CampaignProps {
  id?: string
  name: string
  candidateName: string
  position: 'deputado_federal' | 'deputado_estadual' | 'senador' | 'presidente' | 'vereador' | 'prefeito' | 'governador'
  state?: string
  year: number
  ownerId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class Campaign {
  private constructor(private props: CampaignProps) {}

  static create(props: CampaignProps): Campaign {
    return new Campaign({
      ...props,
      year: props.year ?? 2026,
      isActive: props.isActive ?? true,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    })
  }

  get id(): string | undefined {
    return this.props.id
  }

  get name(): string {
    return this.props.name
  }

  get candidateName(): string {
    return this.props.candidateName
  }

  get position(): string {
    return this.props.position
  }

  get state(): string | undefined {
    return this.props.state
  }

  get year(): number {
    return this.props.year
  }

  get ownerId(): string {
    return this.props.ownerId
  }

  get isActive(): boolean {
    return this.props.isActive
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  toJSON(): CampaignProps {
    return { ...this.props }
  }
}

export interface PartidoProps {
  id?: number
  sigla: string
  nome: string
  numero: number
}

export class Partido {
  private constructor(private props: PartidoProps) {}

  static create(props: PartidoProps): Partido {
    return new Partido(props)
  }

  get id(): number | undefined {
    return this.props.id
  }

  get sigla(): string {
    return this.props.sigla
  }

  get nome(): string {
    return this.props.nome
  }

  get numero(): number {
    return this.props.numero
  }

  toJSON(): PartidoProps {
    return { ...this.props }
  }
}

export interface EstadoProps {
  id?: number
  codigoUf: string
  nome: string
  codigoIbge: number
  regiao: string
}

export class Estado {
  private constructor(private props: EstadoProps) {}

  static create(props: EstadoProps): Estado {
    return new Estado(props)
  }

  get id(): number | undefined {
    return this.props.id
  }

  get codigoUf(): string {
    return this.props.codigoUf
  }

  get nome(): string {
    return this.props.nome
  }

  get codigoIbge(): number {
    return this.props.codigoIbge
  }

  get regiao(): string {
    return this.props.regiao
  }

  toJSON(): EstadoProps {
    return { ...this.props }
  }
}

export interface MunicipalityProps {
  codigoIbge: number
  nome: string
  latitude: number | null
  longitude: number | null
  capital: boolean
  codigoUf: number
  siafiId: number
  ddd: number
  fusoHorario: string
}

export class Municipality {
  private constructor(private props: MunicipalityProps) {}

  static create(props: MunicipalityProps): Municipality {
    return new Municipality(props)
  }

  get codigoIbge(): number {
    return this.props.codigoIbge
  }

  get nome(): string {
    return this.props.nome
  }

  get latitude(): number | null {
    return this.props.latitude
  }

  get longitude(): number | null {
    return this.props.longitude
  }

  get capital(): boolean {
    return this.props.capital
  }

  get codigoUf(): number {
    return this.props.codigoUf
  }

  get siafiId(): number {
    return this.props.siafiId
  }

  get ddd(): number {
    return this.props.ddd
  }

  get fusoHorario(): string {
    return this.props.fusoHorario
  }

  toJSON(): MunicipalityProps {
    return { ...this.props }
  }
}

export interface RegiaoMGProps {
  id?: number
  nome: string
  codigoMesorregiao: number
}

export class RegiaoMG {
  private constructor(private props: RegiaoMGProps) {}

  static create(props: RegiaoMGProps): RegiaoMG {
    return new RegiaoMG(props)
  }

  get id(): number | undefined {
    return this.props.id
  }

  get nome(): string {
    return this.props.nome
  }

  get codigoMesorregiao(): number {
    return this.props.codigoMesorregiao
  }

  toJSON(): RegiaoMGProps {
    return { ...this.props }
  }
}

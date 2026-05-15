export interface CandidatoProps {
  id?: number
  idCandidatoBd: string
  sqCandidato: string
  nome: string
  nomeUrna: string
  partidoId: number | null
  estadoId: number | null
  dataNascimento: Date | null
  genero: string | null
  profissao: string | null
  escolaridade: string | null
  fotoUrl: string | null
  anoEleicao: number
  cargo: string
  numeroCandidato: number
  situacaoCandidatura: string | null
  resultado: string | null
}

export class Candidato {
  private constructor(private props: CandidatoProps) {}

  static create(props: CandidatoProps): Candidato {
    return new Candidato(props)
  }

  get id(): number | undefined {
    return this.props.id
  }

  get idCandidatoBd(): string {
    return this.props.idCandidatoBd
  }

  get sqCandidato(): string {
    return this.props.sqCandidato
  }

  get nome(): string {
    return this.props.nome
  }

  get nomeUrna(): string {
    return this.props.nomeUrna
  }

  get partidoId(): number | null {
    return this.props.partidoId
  }

  get estadoId(): number | null {
    return this.props.estadoId
  }

  get dataNascimento(): Date | null {
    return this.props.dataNascimento
  }

  get genero(): string | null {
    return this.props.genero
  }

  get profissao(): string | null {
    return this.props.profissao
  }

  get escolaridade(): string | null {
    return this.props.escolaridade
  }

  get fotoUrl(): string | null {
    return this.props.fotoUrl
  }

  get anoEleicao(): number {
    return this.props.anoEleicao
  }

  get cargo(): string {
    return this.props.cargo
  }

  get numeroCandidato(): number {
    return this.props.numeroCandidato
  }

  get situacaoCandidatura(): string | null {
    return this.props.situacaoCandidatura
  }

  get resultado(): string | null {
    return this.props.resultado
  }

  get idade(): number | null {
    if (!this.props.dataNascimento) return null
    const hoje = new Date()
    const nascimento = new Date(this.props.dataNascimento)
    let idade = hoje.getFullYear() - nascimento.getFullYear()
    const mesAtual = hoje.getMonth()
    const mesNascimento = nascimento.getMonth()
    if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
      idade--
    }
    return idade
  }

  get eleito(): boolean {
    return this.props.resultado?.toUpperCase().includes('ELEITO') ?? false
  }

  toJSON(): CandidatoProps {
    return { ...this.props }
  }
}

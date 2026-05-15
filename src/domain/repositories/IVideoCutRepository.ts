import { VideoCut, VideoCutStatus } from '../entities/VideoCut.js'

export interface VideoCutFilters {
  status?: VideoCutStatus[]
  tags?: string[]
  fromDate?: Date
  toDate?: Date
}

export interface PaginationOptions {
  page: number
  perPage: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface IVideoCutRepository {
  findById(id: string): Promise<VideoCut | null>
  findByCampaignId(campaignId: string, filters?: VideoCutFilters, pagination?: PaginationOptions): Promise<PaginatedResult<VideoCut>>
  findReadyForPublishing(campaignId: string): Promise<VideoCut[]>
  save(videoCut: VideoCut): Promise<VideoCut>
  update(videoCut: VideoCut): Promise<VideoCut>
  updateStatus(id: string, status: VideoCutStatus): Promise<void>
  delete(id: string): Promise<void>
}

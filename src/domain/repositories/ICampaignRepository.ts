import { Campaign } from '../entities/Campaign.js'

export interface ICampaignRepository {
  findById(id: string): Promise<Campaign | null>
  findByOwnerId(ownerId: string): Promise<Campaign[]>
  findByUserId(userId: string): Promise<Campaign[]> // Inclui campanhas onde o usuário é membro
  findAll(): Promise<Campaign[]>
  save(campaign: Campaign): Promise<Campaign>
  update(campaign: Campaign): Promise<Campaign>
  delete(id: string): Promise<void>
}

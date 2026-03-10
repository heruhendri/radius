/**
 * Agents Feature — Zod Schemas
 *
 * @module features/agents/schemas
 */

import { z } from 'zod'

export const createAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(100),
  phone: z.string().min(8).max(20).regex(/^[0-9+]+$/, 'Nomor HP tidak valid'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  routerId: z.string().optional(),
  minBalance: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const updateAgentSchema = createAgentSchema.partial().omit({ id: true })

export const agentDepositSchema = z.object({
  agentId: z.string().min(1),
  amount: z.number().int().min(1),
  notes: z.string().max(500).optional(),
  method: z.string().optional(),
})

export const agentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  routerId: z.string().optional(),
})

export type CreateAgentInput = z.infer<typeof createAgentSchema>
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
export type AgentDepositInput = z.infer<typeof agentDepositSchema>
export type AgentListQuery = z.infer<typeof agentListQuerySchema>

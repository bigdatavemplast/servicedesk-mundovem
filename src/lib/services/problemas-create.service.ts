import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/lib/auth'

const criarProblemaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título do problema.'),
  prioridade: z.string().trim().min(1, 'Informe a prioridade.'),
  status: z.string().trim().min(1, 'Informe o status.'),
})

export const criarProblema = createServerFn({ method: 'POST' })
  .inputValidator(criarProblemaSchema)
  .handler(async ({ data }) => {
    const { supabase, user } = await requireSupabaseAuth()

    const { data: problema, error } = await supabase
      .from('problemas')
      .insert({
        titulo: data.titulo,
        prioridade: data.prioridade,
        status: data.status,
        criado_por: user.id,
      })
      .select('id, numero, titulo, prioridade, status, criado_em')
      .single()

    if (error) {
      throw new Error(`Não foi possível criar o problema: ${error.message}`)
    }

    return problema
  })

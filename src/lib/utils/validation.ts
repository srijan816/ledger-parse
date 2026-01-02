import { z } from 'zod'

export const uploadSchema = z.object({
    file: z.any() // In browser environment, this would be File. In server action/API, needs careful handling.
        .refine((file) => file?.size <= 50 * 1024 * 1024, `Max file size is 50MB.`)
        .refine(
            (file) => ['application/pdf'].includes(file?.type),
            "Only .pdf formats are supported."
        )
        .optional() // Optional because we might handle file upload separately from metadata
})

export const processSchema = z.object({
    conversionId: z.string().uuid()
})

export const exportSchema = z.object({
    conversionId: z.string().uuid(),
    format: z.enum(['xlsx', 'csv', 'qbo']),
    dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
    includeExcluded: z.boolean().optional().default(false)
})

export const conversionQuerySchema = z.object({
    page: z.string().optional().transform(val => parseInt(val || '1', 10)),
    limit: z.string().optional().transform(val => parseInt(val || '20', 10)),
})

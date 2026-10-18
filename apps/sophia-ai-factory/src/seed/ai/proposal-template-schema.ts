import { z } from 'zod';

export const proposalTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  industry: z.string().optional(),
  systemPrompt: z.string(),
  userPromptTemplate: z.string(),
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      description: z.string(),
      required: z.boolean().default(true),
    }),
  ),
  isSystem: z.boolean().default(false),
  createdAt: z.date().optional(),
});

export type ProposalTemplate = z.infer<typeof proposalTemplateSchema>;

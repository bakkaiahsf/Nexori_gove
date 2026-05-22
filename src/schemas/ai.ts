import { z } from "zod";

export const AIProviderSchema = z.enum(["openai", "anthropic"]);

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

export const AIChatRequestSchema = z.object({
  provider: AIProviderSchema.optional(),
  model: z.string().optional(),
  messages: z.array(ChatMessageSchema).min(1),
  action: z.string().min(1).max(100),
  projectId: z.string().cuid().optional(),
  sessionId: z.string().optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
});

export type AIProvider = z.infer<typeof AIProviderSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;

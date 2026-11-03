import { z } from "zod";
import { EMAIL_RE } from "@/lib/email";

export const ProjectSchema = z.object({
  name: z.string().min(2),
  ownerAddress: z.string().min(3),
  contactEmail: z.string().regex(EMAIL_RE).optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  createdAt: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

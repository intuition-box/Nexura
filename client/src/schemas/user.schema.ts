import { z } from "zod";
import { EMAIL_RE } from "@/lib/email";

export const UserSchema = z.object({
  id: z.string().optional(),
  address: z.string().min(3),
  username: z.string().optional(),
  email: z.string().regex(EMAIL_RE).optional(),
  createdAt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type User = z.infer<typeof UserSchema>;

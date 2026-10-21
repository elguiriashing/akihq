import { z } from "zod";
const workspace = z.object({
  id: z.string().min(3).max(80),
  name: z.string().min(1).max(200),
});
const options = z.object({
  can_link: z.boolean(),
  options: z.array(workspace).max(51),
  current: workspace.nullable().optional(),
  has_link: z.boolean().optional(),
});
export function readRentalPulseLinks(value: unknown) {
  const parsed = options.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export type RentalPulseLinks = NonNullable<
  ReturnType<typeof readRentalPulseLinks>
>;

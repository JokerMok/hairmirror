import { z } from "zod";

export const designPreferencesSchema = z
  .object({
    audience: z.enum(["masculine", "feminine", "neutral"]),
    currentLength: z.enum(["short", "medium", "long"]),
    targetLength: z.enum(["short", "medium", "long"]),
    goal: z.enum(["fresh", "younger", "volume", "professional", "fashion"]),
    texture: z.enum(["straight", "wavy", "curly", "coily"]).default("straight"),
    density: z.enum(["fine", "medium", "thick"]).default("medium"),
    faceShape: z
      .enum(["auto", "oval", "round", "square", "heart", "long"])
      .default("auto"),
    fringe: z.enum(["open", "avoid", "soft", "full"]).default("open"),
    parting: z.enum(["auto", "center", "side"]).default("auto"),
    treatmentMode: z.enum(["cut_only", "perm_allowed"]),
    colorMode: z.enum(["preserve", "change"]),
    targetHairColor: z
      .enum(["black", "dark_brown", "brown", "blonde", "red", "gray", "custom"])
      .optional(),
    customHairColor: z.string().trim().min(1).max(80).optional(),
    dailyMinutes: z.number().min(0).max(60),
  })
  .refine(
    (value) => value.colorMode !== "change" || Boolean(value.targetHairColor),
    { path: ["targetHairColor"], message: "TARGET_HAIR_COLOR_REQUIRED" },
  )
  .refine(
    (value) => value.targetHairColor !== "custom" || Boolean(value.customHairColor),
    { path: ["customHairColor"], message: "CUSTOM_HAIR_COLOR_REQUIRED" },
  );

export type DesignPreferencesInput = z.infer<typeof designPreferencesSchema>;

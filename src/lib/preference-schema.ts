import { z } from "zod";
import { getHairColorPreferenceError } from "./types";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

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
    targetHairColor: z.preprocess(
      emptyStringToUndefined,
      z
        .enum(["black", "dark_brown", "brown", "blonde", "red", "gray", "custom"])
        .optional(),
    ),
    customHairColor: z.string().trim().max(80).optional(),
    dailyMinutes: z.number().min(0).max(60),
  })
  .superRefine((value, context) => {
    const error = getHairColorPreferenceError(value);
    if (!error) return;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [error === "CUSTOM_HAIR_COLOR_REQUIRED" ? "customHairColor" : "targetHairColor"],
      message: error,
    });
  });

export type DesignPreferencesInput = z.infer<typeof designPreferencesSchema>;

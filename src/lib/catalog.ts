import type { HairstyleTemplate, HairGoal, TreatmentMode } from "@/lib/types";

export const GOAL_LABELS: Record<HairGoal, string> = {
  fresh: "清爽精神",
  younger: "自然减龄",
  volume: "视觉增量",
  professional: "职业稳重",
  fashion: "风格变化",
};

export const HAIRSTYLE_DIRECTION_COUNT = 3;

export const HAIRSTYLES: HairstyleTemplate[] = [
  {
    id: "textured-crop",
    name: "轻纹理短碎",
    audience: "masculine",
    length: "short",
    goal: ["fresh", "volume"],
    maintenance: "低",
    conditions: "适合短发基础，可用少量发泥整理",
    description: "顶部轻微纹理，轮廓干净，日常好打理。",
    visual: "crop",
    previewColor: "#30251f",
  },
  {
    id: "clean-side",
    name: "自然侧分",
    audience: "all",
    length: "short",
    goal: ["professional", "fresh"],
    maintenance: "中",
    conditions: "需要顶部保留一定长度",
    description: "清晰但不过分刻板，适合通勤场景。",
    visual: "crop",
    previewColor: "#3a2920",
  },
  {
    id: "soft-waves",
    name: "柔和微卷",
    audience: "all",
    length: "medium",
    goal: ["younger", "fashion", "volume"],
    maintenance: "中",
    conditions: "直发可能需要烫发或卷发工具",
    requiresPermOrHeat: true,
    description: "柔化面部轮廓，增加自然空气感。",
    visual: "waves",
    previewColor: "#3d2b22",
  },
  {
    id: "collar-layer",
    name: "锁骨层次",
    audience: "feminine",
    length: "medium",
    goal: ["younger", "fashion"],
    maintenance: "低",
    conditions: "当前长度至少接近下颌",
    description: "层次轻盈，保留长度同时改善轮廓。",
    visual: "layer",
    previewColor: "#2d221e",
  },
  {
    id: "long-layer",
    name: "长发流线层次",
    audience: "all",
    length: "long",
    goal: ["fashion", "volume"],
    maintenance: "中",
    conditions: "细软发需配合蓬松打理",
    description: "通过高低层次增加动感，避免厚重。",
    visual: "layer",
    previewColor: "#35231e",
  },
  {
    id: "french-bob",
    name: "法式短波波",
    audience: "feminine",
    length: "short",
    goal: ["younger", "fashion"],
    maintenance: "中",
    conditions: "需接受下颌附近的明确长度",
    description: "轮廓利落，搭配自然刘海更柔和。",
    visual: "waves",
    previewColor: "#2a211d",
  },
  {
    id: "air-bangs",
    name: "空气刘海中长发",
    audience: "feminine",
    length: "long",
    goal: ["younger", "fresh"],
    maintenance: "高",
    conditions: "刘海需要每日整理，油性发质维护频率更高",
    description: "保留长发气质，以轻刘海调整视觉重心。",
    visual: "layer",
    previewColor: "#3a2922",
  },
  {
    id: "neutral-shag",
    name: "中性轻狼尾",
    audience: "all",
    length: "medium",
    goal: ["fashion", "volume"],
    maintenance: "中",
    conditions: "后颈需保留长度，适合接受明显层次",
    description: "轮廓有辨识度，兼顾蓬松和轻盈。",
    visual: "layer",
    previewColor: "#29211d",
  },
  {
    id: "straight-layer",
    name: "直发轻层次",
    audience: "all",
    length: "medium",
    goal: ["fresh", "professional", "volume"],
    maintenance: "低",
    conditions: "适合直发和中等长度，依靠剪裁形成轮廓，不需要烫发或卷发工具",
    description: "保留自然直发质感，以轻薄层次改善轮廓，日常只需简单梳理。",
    visual: "layer",
    previewColor: "#33251f",
  },
  {
    id: "long-soft-curl",
    name: "长发自然大弯",
    audience: "all",
    length: "long",
    goal: ["younger", "fashion", "volume"],
    maintenance: "中",
    conditions: "长度保持在胸口附近，以自然大弯增加蓬松感",
    requiresPermOrHeat: true,
    description: "明确保留长发长度，只增加柔和大弯和轻盈层次。",
    visual: "waves",
    previewColor: "#38251f",
  },
  {
    id: "sleek-long",
    name: "长发顺直层次",
    audience: "all",
    length: "long",
    goal: ["professional", "fresh", "fashion"],
    maintenance: "低",
    conditions: "长度保持在胸口附近，不剪成中长发或短发",
    description: "保留清晰长发轮廓，以面部两侧轻层次提升利落感。",
    visual: "layer",
    previewColor: "#30231f",
  },
];

export function isTemplateCompatibleWithTreatmentMode(
  template: HairstyleTemplate,
  treatmentMode: TreatmentMode = "cut_only",
) {
  return treatmentMode === "perm_allowed" || !template.requiresPermOrHeat;
}

export function recommendTemplates(preferences: {
  audience: string;
  targetLength: string;
  goal: HairGoal;
  treatmentMode?: TreatmentMode;
}) {
  const candidates = HAIRSTYLES.filter(
    (item) =>
      item.length === preferences.targetLength &&
      isTemplateCompatibleWithTreatmentMode(item, preferences.treatmentMode),
  );
  const scored = candidates.map((item) => ({
    item,
    score:
      (item.goal.includes(preferences.goal) ? 3 : 0) +
      (item.audience === "all" || item.audience === preferences.audience
        ? 2
        : -3),
  }));
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, HAIRSTYLE_DIRECTION_COUNT)
    .map(({ item }) => item);
}

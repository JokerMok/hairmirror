"use client";

import Image from "next/image";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export const SHOWCASE_CASES = [
  {
    title: { en: "Long-hair directions", zh: "长发方向" },
    note: { en: "Long hair · three levels of movement", zh: "长发 · 三种层次变化" },
    source: "/showcase/sources/woman-01.jpg",
    styles: [
      { image: "/showcase/cases/case-01/style-01.jpg", label: { en: "Soft waves", zh: "柔和大波浪" } },
      { image: "/showcase/cases/case-01/style-02.jpg", label: { en: "Long layers", zh: "轻盈长层次" } },
      { image: "/showcase/cases/case-01/style-03.jpg", label: { en: "Curtain fringe", zh: "八字刘海" } },
    ],
  },
  {
    title: { en: "From sharp to relaxed", zh: "从利落到松弛" },
    note: { en: "Short hair · three distinct silhouettes", zh: "短发 · 三种清晰轮廓" },
    source: "/showcase/sources/man-01.jpg",
    styles: [
      { image: "/showcase/cases/case-02/style-01.jpg", label: { en: "Textured crop", zh: "纹理短碎" } },
      { image: "/showcase/cases/case-02/style-02.jpg", label: { en: "Natural side", zh: "自然侧分" } },
      { image: "/showcase/cases/case-02/style-03.jpg", label: { en: "French bob", zh: "法式短波波" } },
    ],
  },
  {
    title: { en: "Medium-length options", zh: "中长发方向" },
    note: { en: "Medium hair · texture and length compared", zh: "中发 · 比较纹理与长度" },
    source: "/showcase/sources/man-02.jpg",
    styles: [
      { image: "/showcase/cases/case-03/style-01.jpg", label: { en: "Soft waves", zh: "柔和微卷" } },
      { image: "/showcase/cases/case-03/style-02.jpg", label: { en: "Neutral shag", zh: "自然碎层" } },
      { image: "/showcase/cases/case-03/style-03.jpg", label: { en: "Collar layers", zh: "锁骨层次" } },
    ],
  },
  {
    title: { en: "Three short-cut moods", zh: "三种短发气质" },
    note: { en: "Short hair · shape changes the expression", zh: "短发 · 轮廓改变整体气质" },
    source: "/showcase/sources/woman-02.jpg",
    styles: [
      { image: "/showcase/cases/case-04/style-01.jpg", label: { en: "French bob", zh: "法式波波" } },
      { image: "/showcase/cases/case-04/style-02.jpg", label: { en: "Soft side", zh: "柔和侧分" } },
      { image: "/showcase/cases/case-04/style-03.jpg", label: { en: "Textured crop", zh: "纹理短发" } },
    ],
  },
] as const;

const feedback = [
  {
    title: { en: "Easier salon conversations", zh: "更容易和发型师沟通" },
    quote: {
      en: "A visual direction is easier to discuss with a stylist than a description from memory.",
      zh: "明确的视觉方向，比凭记忆描述更容易和发型师沟通。",
    },
  },
  {
    title: { en: "Realistic upkeep matters", zh: "打理成本同样重要" },
    quote: {
      en: "Upkeep notes help rule out styles that do not fit a realistic morning routine.",
      zh: "打理说明可以提前排除不符合日常时间安排的发型。",
    },
  },
  {
    title: { en: "Compare before committing", zh: "决定前先做比较" },
    quote: {
      en: "Comparing different lengths side by side makes a permanent change easier to evaluate.",
      zh: "把不同长度并排比较，更容易判断自己是否适合做出明显改变。",
    },
  },
] as const;

export function HomeShowcase({ locale }: { locale: Locale }) {
  const language = locale === "zh-CN" ? "zh" : "en";
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCase = SHOWCASE_CASES[activeIndex];
  const showCase = (index: number) => setActiveIndex((index + SHOWCASE_CASES.length) % SHOWCASE_CASES.length);

  return (
    <section className="showcase-shell" aria-label={language === "en" ? "Hairstyle comparison cases" : "发型对比案例"}>
      <div className="showcase-heading">
        <div>
          <p className="eyebrow">{language === "en" ? "Four source-backed comparison cases" : "四组有原图依据的对比案例"}</p>
          <h2>{language === "en" ? "One reference. Three hairstyle directions." : "一张原图，三种发型方向"}</h2>
        </div>
        <p>
          {language === "en"
            ? "Compare each original reference with three realistic hairstyle directions."
            : "每组都先看原始照片，再比较三种贴近现实的发型方向。"}
        </p>
      </div>

      <div className="showcase-case-head" aria-live="polite">
        <div>
          <span>{language === "en" ? `Case ${String(activeIndex + 1).padStart(2, "0")}` : `案例 ${String(activeIndex + 1).padStart(2, "0")}`}</span>
          <h3>{activeCase.title[language]}</h3>
        </div>
        <p>{activeCase.note[language]}</p>
      </div>

      {activeCase.source && (
        <div className="showcase-source-row">
          <figure className="showcase-source-card">
            <div className="showcase-source-image">
              <Image
                src={activeCase.source}
                alt={language === "en" ? "Original source photo" : "原始照片"}
                fill
                priority={activeIndex === 0}
                unoptimized
                sizes="(max-width: 680px) 28vw, 180px"
                className="object-cover object-center"
              />
            </div>
            <figcaption>{language === "en" ? "Original photo" : "原始照片"}</figcaption>
          </figure>
          <div className="showcase-source-copy">
            <span>{language === "en" ? "Reference kept visible" : "保留原始参照"}</span>
            <p>
              {language === "en"
                ? "The original reference stays visible so you can compare the starting point, framing, and facial features yourself."
                : "原始参照会一直保留，方便你自行比较起点、构图和面部特征。"}
            </p>
          </div>
        </div>
      )}

      <div className="showcase-triptych">
        {activeCase.styles.map((style, index) => (
          <figure className="showcase-style" key={style.image}>
            <div className="showcase-style-image">
              <Image
                src={style.image}
                alt={`${style.label[language]} — ${language === "en" ? `case ${activeIndex + 1}` : `案例 ${activeIndex + 1}`}`}
                fill
                priority={activeIndex === 0}
                unoptimized
                sizes="(max-width: 680px) 33vw, 390px"
                className="object-cover object-center"
              />
              <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <figcaption>{style.label[language]}</figcaption>
          </figure>
        ))}
      </div>

      <div className="showcase-navigation">
        <button type="button" className="showcase-arrow" onClick={() => showCase(activeIndex - 1)} aria-label={language === "en" ? "Previous case" : "上一个案例"}>
          <ChevronLeft size={19} />
        </button>
        <div className="showcase-tabs" role="tablist" aria-label={language === "en" ? "Choose a comparison case" : "选择对比案例"}>
          {SHOWCASE_CASES.map((item, index) => (
            <button
              key={item.title.en}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              className={activeIndex === index ? "is-active" : ""}
              onClick={() => showCase(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item.title[language]}</b>
            </button>
          ))}
        </div>
        <button type="button" className="showcase-arrow" onClick={() => showCase(activeIndex + 1)} aria-label={language === "en" ? "Next case" : "下一个案例"}>
          <ChevronRight size={19} />
        </button>
      </div>
    </section>
  );
}

export function FeedbackSection({ locale }: { locale: Locale }) {
  const language = locale === "zh-CN" ? "zh" : "en";
  return (
    <section className="section-block" aria-labelledby="feedback-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{language === "en" ? "Decision needs" : "决策关注"}</p>
          <h2 id="feedback-heading">{language === "en" ? "More confidence before the cut" : "剪发前，心里更有底"}</h2>
        </div>
        <a href="#studio" className="text-link">
          {language === "en" ? "Try it yourself" : "亲自试试看"}<ArrowUpRight size={17} />
        </a>
      </div>
      <div className="feedback-grid">
        {feedback.map((item, index) => (
          <article key={item.title.en} className="feedback-item">
            <span className="feedback-index" aria-hidden>0{index + 1}</span>
            <blockquote>{item.quote[language]}</blockquote>
            <p>{item.title[language]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

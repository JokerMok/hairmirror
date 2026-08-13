import { StudioWizard } from "@/components/studio-wizard";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default async function Home() {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: SITE_NAME,
          url: absoluteUrl("/"),
          description: SITE_DESCRIPTION,
          applicationCategory: "LifestyleApplication",
          operatingSystem: "Any device with a modern web browser",
          browserRequirements: "Requires JavaScript and image upload support",
          featureList: [
            "Preview three hairstyle directions from one photo",
            "Compare hairstyles side by side",
            "Save hairstyle choices and generation history",
            "Delete generated results at any time",
          ],
        }}
      />
      <StudioWizard locale={locale} />
    </>
  );
}

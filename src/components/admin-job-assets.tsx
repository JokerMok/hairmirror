import Image from "next/image";

const UUID_PATTERN = /^[0-9a-f-]{36}$/;

export function AdminJobAssets({
  assetIds,
  variantCount,
}: {
  assetIds: unknown;
  variantCount: unknown;
}) {
  const ids = String(assetIds ?? "")
    .split(",")
    .filter((id) => UUID_PATTERN.test(id));
  const count = Number(variantCount);
  if (ids.length === 0)
    return <span className="text-white/45">{count} 张</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {ids.map((id, index) => (
          <a
            key={id}
            href={`/api/generated-assets/${id}`}
            target="_blank"
            rel="noreferrer"
            title={`查看第 ${index + 1} 张生成图片`}
            className="block overflow-hidden rounded-md border border-white/15 transition hover:border-[#e5b56d]"
          >
            <Image
              src={`/api/generated-assets/${id}`}
              alt={`第 ${index + 1} 张生成图片`}
              width={48}
              height={60}
              unoptimized
              className="h-[60px] w-12 object-cover"
            />
          </a>
        ))}
      </div>
      <span className="text-xs text-white/45">
        {ids.length}/{Number.isFinite(count) ? count : ids.length}
      </span>
    </div>
  );
}

export default function HealthGauge({ score }: { score: number }) {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? "#0050cb" : score >= 50 ? "#cc4204" : "#ba1a1a";

  return (
    <article className="flex flex-col items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest p-lg">
      <h3 className="font-label-caps text-label-caps mb-6 w-full text-left uppercase text-on-surface">
        系统健康度
      </h3>
      <div className="relative flex h-48 w-48 items-center justify-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e1e2ee" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display-data text-display-data text-on-surface">
            {score}
            <span className="text-xl">%</span>
          </span>
          <span className="font-status-label text-status-label mt-1 text-outline">
            {score >= 80 ? "稳定" : score >= 50 ? "注意" : "异常"}
          </span>
        </div>
      </div>
    </article>
  );
}

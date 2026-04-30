import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

type Props = {
  title: string;
  data: number[];
  labels: string[];
  type?: "line" | "bar";
};

export default function ChartCard({ title, data, labels, type = "line" }: Props) {
  const option = useMemo(() => {
    const base = {
      title: {
        text: title,
        left: 12,
        top: 10,
        textStyle: {
          color: "#191b24",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "Inter",
        },
      },
      grid: { left: 44, right: 16, top: 44, bottom: 28 },
      xAxis: {
        type: "category" as const,
        boundaryGap: type === "bar",
        axisLabel: { color: "#727687", fontSize: 10 },
        axisLine: { lineStyle: { color: "#c2c6d8" } },
        data: labels,
      },
      yAxis: {
        type: "value" as const,
        axisLabel: { color: "#727687", fontSize: 10 },
        splitLine: { lineStyle: { color: "#e1e2ee" } },
      },
      tooltip: { trigger: "axis" as const },
    };

    if (type === "bar") {
      return {
        ...base,
        series: [
          {
            type: "bar",
            data,
            barWidth: "50%",
            itemStyle: {
              color: "#0050cb",
              borderRadius: [4, 4, 0, 0],
            },
          },
        ],
      };
    }

    return {
      ...base,
      series: [
        {
          type: "line",
          smooth: true,
          data,
          symbol: "none",
          lineStyle: { color: "#0050cb", width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(0,80,203,0.15)" },
                { offset: 1, color: "rgba(0,80,203,0.02)" },
              ],
            },
          },
        },
      ],
    };
  }, [title, data, labels, type]);

  return (
    <article className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg">
      <ReactECharts option={option} style={{ height: 260 }} />
    </article>
  );
}

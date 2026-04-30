import { useStatePolling, useEvents, useRealtimeMetrics } from "../hooks/useApi";
import DeviceCard from "../components/Dashboard/DeviceCard";
import ChartCard from "../components/Dashboard/ChartCard";
import AlertList from "../components/Dashboard/AlertList";
import HealthGauge from "../components/Dashboard/HealthGauge";
import {
  CardSkeleton,
  ChartSkeleton,
  AlertListSkeleton,
  GaugeSkeleton,
  PageSkeleton,
} from "../components/Skeleton";

export default function DashboardPage() {
  const { devices, loading } = useStatePolling(3000);
  const { events } = useEvents(1, 20);
  const { realtime } = useRealtimeMetrics(3000);

  const onlineRate = realtime ? Math.round(realtime.health_score) : 100;
  const hasData = !loading && devices.length > 0;

  return (
    <PageSkeleton>
      {/* 设备卡片 */}
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
        {hasData ? (
          devices.map((d) => <DeviceCard key={d.device_id} device={d} />)
        ) : (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        )}
      </div>

      {/* 图表 */}
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
        {hasData ? (
          <>
            <ChartCard
              title="实时数据吞吐量"
              data={realtime?.throughput ?? []}
              labels={realtime?.labels ?? []}
            />
            <ChartCard
              title="系统延迟 (ms)"
              data={realtime?.latency_ms ?? []}
              labels={realtime?.labels ?? []}
              type="bar"
            />
          </>
        ) : (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        )}
      </div>

      {/* 告警 + 健康度 */}
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        {hasData ? (
          <>
            <AlertList events={events} />
            <HealthGauge score={onlineRate} />
          </>
        ) : (
          <>
            <AlertListSkeleton />
            <GaugeSkeleton />
          </>
        )}
      </div>
    </PageSkeleton>
  );
}

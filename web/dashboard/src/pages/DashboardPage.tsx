import { useStatePolling, useEvents, useMetrics } from "../hooks/useApi";
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

const timeLabels = ["-55s", "-50s", "-45s", "-40s", "-35s", "-30s", "-25s", "-20s", "-15s", "-10s", "-5s", "now"];

export default function DashboardPage() {
  const { devices, loading } = useStatePolling(3000);
  const { events } = useEvents(20);
  const { metrics } = useMetrics();

  const onlineRate = metrics ? Math.round(metrics.online_rate) : 100;
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
            <ChartCard title="实时数据吞吐量" data={devices.map((d) => d.heartbeat_seq)} labels={timeLabels} />
            <ChartCard title="系统延迟 (ms)" data={devices.map(() => 60 + Math.round(Math.random() * 20))} labels={timeLabels} type="bar" />
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

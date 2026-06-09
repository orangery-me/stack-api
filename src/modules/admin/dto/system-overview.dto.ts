export class SystemOverviewDto {
  totalUsers: number;
  totalUsersChange: number;
  activeUsers: number;
  activeUsersChange: number;
  activeUsersPeriod: string;
  systemUptime: number;
  systemUptimeChange: number;
  storageUsed: number;
  storageTotal: number;
  storageUnit: string;
  incidents: number;
  incidentsResolved: number;
  cpuUsage: number;
  apiLatency: number;
  apiLatencyUnit: string;
}

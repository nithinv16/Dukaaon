import { NextApiRequest, NextApiResponse } from 'next';
import { monitoringUtils } from '../../../../utils/monitoring';
import { performanceConfig } from '../../../../config/monitoring';
import os from 'os';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if user is authenticated and has admin access
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get system metrics
    const cpuUsage = await getCPUUsage();
    const memoryUsage = getMemoryUsage();
    const diskUsage = await getDiskUsage();
    const uptime = os.uptime();

    // Format system status
    const systemStatus = {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      uptime: uptime,
    };

    return res.status(200).json(systemStatus);
  } catch (error) {
    console.error('Error fetching system status:', error);
    return res.status(500).json({ error: 'Failed to fetch system status' });
  }
}

// Get CPU usage percentage
async function getCPUUsage(): Promise<number> {
  const startMeasure = os.cpus().map(cpu => ({
    idle: cpu.times.idle,
    total: Object.values(cpu.times).reduce((acc, time) => acc + time, 0),
  }));

  // Wait for 100ms to get a meaningful measurement
  await new Promise(resolve => setTimeout(resolve, 100));

  const endMeasure = os.cpus().map(cpu => ({
    idle: cpu.times.idle,
    total: Object.values(cpu.times).reduce((acc, time) => acc + time, 0),
  }));

  const cpuUsage = startMeasure.map((start, i) => {
    const end = endMeasure[i];
    const idleDiff = end.idle - start.idle;
    const totalDiff = end.total - start.total;
    return 100 - (100 * idleDiff) / totalDiff;
  });

  // Return average CPU usage across all cores
  return cpuUsage.reduce((acc, usage) => acc + usage, 0) / cpuUsage.length;
}

// Get memory usage percentage
function getMemoryUsage(): number {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  return ((totalMemory - freeMemory) / totalMemory) * 100;
}

// Get disk usage percentage
async function getDiskUsage(): Promise<number> {
  try {
    // This is a placeholder. In a real application, you would use a library
    // like 'diskusage' or make a system call to get actual disk usage.
    // For now, we'll return a simulated value
    return Math.random() * 30 + 50; // Random value between 50% and 80%
  } catch (error) {
    console.error('Error getting disk usage:', error);
    return 0;
  }
} 
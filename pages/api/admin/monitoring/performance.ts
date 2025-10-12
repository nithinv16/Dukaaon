import { NextApiRequest, NextApiResponse } from 'next';
import { monitoringUtils } from '../../../../utils/monitoring';
import { performanceConfig } from '../../../../config/monitoring';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if user is authenticated and has admin access
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get time range from query parameters
    const { start, end } = req.query;
    const startTime = start ? new Date(start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours
    const endTime = end ? new Date(end as string) : new Date();

    // Fetch performance data from monitoring system
    // This would typically involve querying your monitoring database
    const performanceData = await monitoringUtils.getPerformanceData(startTime, endTime);

    // Format data for the chart
    const formattedData = performanceData.map(data => ({
      timestamp: data.timestamp,
      value: data.value,
    }));

    return res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching performance data:', error);
    return res.status(500).json({ error: 'Failed to fetch performance data' });
  }
} 
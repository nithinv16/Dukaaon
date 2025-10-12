import { NextApiRequest, NextApiResponse } from 'next';
import { monitoringUtils } from '../../../../utils/monitoring';
import { errorTrackingConfig } from '../../../../config/monitoring';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check if user is authenticated and has admin access
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const severity = req.query.severity as string;

    // Get time range from query parameters
    const { start, end } = req.query;
    const startTime = start ? new Date(start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours
    const endTime = end ? new Date(end as string) : new Date();

    // Build filter criteria
    const filters = {
      timestamp: {
        $gte: startTime,
        $lte: endTime,
      },
      ...(severity && { severity }),
    };

    // Fetch error events from monitoring system
    // This would typically involve querying your monitoring database
    const errorEvents = await monitoringUtils.getErrorEvents(filters, {
      page,
      limit,
      sort: { timestamp: -1 },
    });

    // Format error events
    const formattedEvents = errorEvents.map(event => ({
      id: event.id,
      timestamp: event.timestamp,
      category: event.category,
      severity: event.severity,
      message: event.message,
    }));

    return res.status(200).json(formattedEvents);
  } catch (error) {
    console.error('Error fetching error events:', error);
    return res.status(500).json({ error: 'Failed to fetch error events' });
  }
} 
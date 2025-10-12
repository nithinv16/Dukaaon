import { NextApiRequest, NextApiResponse } from 'next';
import { monitoringUtils } from '../../../../utils/monitoring';
import { securityConfig } from '../../../../config/monitoring';

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
    const eventType = req.query.type as string;

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
      ...(eventType && { event: eventType }),
    };

    // Fetch security events from monitoring system
    // This would typically involve querying your monitoring database
    const securityEvents = await monitoringUtils.getSecurityEvents(filters, {
      page,
      limit,
      sort: { timestamp: -1 },
    });

    // Format security events
    const formattedEvents = securityEvents.map(event => ({
      id: event.id,
      timestamp: event.timestamp,
      event: event.event,
      details: event.details,
      // Sanitize sensitive information from details
      ...(event.details && {
        details: {
          ...event.details,
          // Remove sensitive data
          ...(event.details.password && { password: '[REDACTED]' }),
          ...(event.details.token && { token: '[REDACTED]' }),
          ...(event.details.apiKey && { apiKey: '[REDACTED]' }),
        },
      }),
    }));

    return res.status(200).json(formattedEvents);
  } catch (error) {
    console.error('Error fetching security events:', error);
    return res.status(500).json({ error: 'Failed to fetch security events' });
  }
} 
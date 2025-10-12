import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Types
interface PerformanceMetric {
  timestamp: string;
  value: number;
}

interface ErrorEvent {
  id: string;
  timestamp: string;
  category: string;
  severity: string;
  message: string;
}

interface SecurityEvent {
  id: string;
  timestamp: string;
  event: string;
  details: Record<string, any>;
}

interface SystemStatus {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
}

// Monitoring Dashboard Component
const MonitoringDashboard: React.FC = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>([]);
  const [errorEvents, setErrorEvents] = useState<ErrorEvent[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Fetch monitoring data
  useEffect(() => {
    const fetchMonitoringData = async () => {
      try {
        setLoading(true);
        
        // Fetch performance data
        const performanceResponse = await fetch('/api/admin/monitoring/performance');
        const performanceData = await performanceResponse.json();
        setPerformanceData(performanceData);
        
        // Fetch error events
        const errorResponse = await fetch('/api/admin/monitoring/errors');
        const errorData = await errorResponse.json();
        setErrorEvents(errorData);
        
        // Fetch security events
        const securityResponse = await fetch('/api/admin/monitoring/security');
        const securityData = await securityResponse.json();
        setSecurityEvents(securityData);
        
        // Fetch system status
        const statusResponse = await fetch('/api/admin/monitoring/status');
        const statusData = await statusResponse.json();
        setSystemStatus(statusData);
        
      } catch (err) {
        setError('Failed to fetch monitoring data');
        console.error('Monitoring data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    // Initial fetch
    fetchMonitoringData();
    
    // Set up polling
    const interval = setInterval(fetchMonitoringData, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Monitoring Dashboard
      </Typography>

      {/* System Status */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                CPU Usage
              </Typography>
              <Typography variant="h4">
                {systemStatus?.cpu.toFixed(1)}%
              </Typography>
              <Typography color="textSecondary">
                {systemStatus?.cpu > 80 ? 'High' : systemStatus?.cpu > 60 ? 'Medium' : 'Low'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Memory Usage
              </Typography>
              <Typography variant="h4">
                {systemStatus?.memory.toFixed(1)}%
              </Typography>
              <Typography color="textSecondary">
                {systemStatus?.memory > 80 ? 'High' : systemStatus?.memory > 60 ? 'Medium' : 'Low'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Disk Usage
              </Typography>
              <Typography variant="h4">
                {systemStatus?.disk.toFixed(1)}%
              </Typography>
              <Typography color="textSecondary">
                {systemStatus?.disk > 80 ? 'High' : systemStatus?.disk > 60 ? 'Medium' : 'Low'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Uptime
              </Typography>
              <Typography variant="h4">
                {Math.floor(systemStatus?.uptime || 0 / 3600)}h
              </Typography>
              <Typography color="textSecondary">
                {Math.floor((systemStatus?.uptime || 0 % 3600) / 60)}m
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Performance Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            API Response Time
          </Typography>
          <Box height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  name="Response Time (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Error Events */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Error Events
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {errorEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{event.category}</TableCell>
                    <TableCell>
                      <Typography
                        color={
                          event.severity === 'critical'
                            ? 'error'
                            : event.severity === 'high'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {event.severity}
                      </Typography>
                    </TableCell>
                    <TableCell>{event.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Security Events */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Security Events
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {securityEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{event.event}</TableCell>
                    <TableCell>
                      <pre style={{ margin: 0 }}>
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MonitoringDashboard; 
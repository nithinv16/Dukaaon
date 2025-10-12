import { NextRequest } from 'next/server';
import { authMiddleware } from '../../../middleware/auth';

describe('Authentication Middleware', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    mockRequest = new NextRequest('http://localhost:3000/api/protected', {
      headers: new Headers(),
    });
  });

  it('should return 401 for missing token', async () => {
    const response = await authMiddleware(mockRequest);
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({
      error: 'Authentication token is required',
    });
  });

  it('should return 401 for invalid token', async () => {
    mockRequest.headers.set('Authorization', 'Bearer invalid-token');
    const response = await authMiddleware(mockRequest);
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({
      error: 'Invalid authentication token',
    });
  });

  it('should return 403 for insufficient permissions', async () => {
    // Mock a valid token with insufficient permissions
    mockRequest.headers.set('Authorization', 'Bearer valid-token-with-wrong-role');
    const response = await authMiddleware(mockRequest);
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({
      error: 'Insufficient permissions to access this route',
    });
  });

  it('should return 429 for rate limit exceeded', async () => {
    // Mock rate limit exceeded
    mockRequest.headers.set('Authorization', 'Bearer valid-token');
    const response = await authMiddleware(mockRequest);
    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({
      error: 'Too many requests, please try again later.',
    });
  });
}); 
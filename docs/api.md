# Dukaaon API Documentation

## Authentication

### Login
- **Endpoint**: `/api/auth/login`
- **Method**: POST
- **Description**: Authenticate user and return JWT token
- **Request Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "token": "string",
    "user": {
      "id": "string",
      "email": "string",
      "role": "string"
    }
  }
  ```

### Register
- **Endpoint**: `/api/auth/register`
- **Method**: POST
- **Description**: Register new user
- **Request Body**:
  ```json
  {
    "email": "string",
    "password": "string",
    "role": "string",
    "businessDetails": {
      "name": "string",
      "type": "string",
      "address": "string"
    }
  }
  ```
- **Response**:
  ```json
  {
    "message": "Registration successful",
    "userId": "string"
  }
  ```

### Verify OTP
- **Endpoint**: `/api/auth/verify-otp`
- **Method**: POST
- **Description**: Verify OTP for user registration
- **Request Body**:
  ```json
  {
    "email": "string",
    "otp": "string"
  }
  ```
- **Response**:
  ```json
  {
    "message": "OTP verified successfully"
  }
  ```

## Products

### List Products
- **Endpoint**: `/api/products`
- **Method**: GET
- **Description**: Get list of products with pagination and filters
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
  - `category`: string
  - `search`: string
  - `minPrice`: number
  - `maxPrice`: number
- **Response**:
  ```json
  {
    "products": [
      {
        "id": "string",
        "name": "string",
        "description": "string",
        "price": number,
        "category": "string",
        "sellerId": "string"
      }
    ],
    "total": number,
    "page": number,
    "totalPages": number
  }
  ```

### Get Product Details
- **Endpoint**: `/api/products/[id]`
- **Method**: GET
- **Description**: Get detailed information about a specific product
- **Response**:
  ```json
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "price": number,
    "category": "string",
    "sellerId": "string",
    "images": ["string"],
    "specifications": object,
    "stock": number
  }
  ```

## Orders

### Create Order
- **Endpoint**: `/api/orders`
- **Method**: POST
- **Description**: Create a new order
- **Request Body**:
  ```json
  {
    "items": [
      {
        "productId": "string",
        "quantity": number
      }
    ],
    "shippingAddress": {
      "street": "string",
      "city": "string",
      "state": "string",
      "country": "string",
      "zipCode": "string"
    }
  }
  ```
- **Response**:
  ```json
  {
    "orderId": "string",
    "status": "string",
    "totalAmount": number
  }
  ```

### Get Order Status
- **Endpoint**: `/api/orders/[id]/status`
- **Method**: GET
- **Description**: Get current status of an order
- **Response**:
  ```json
  {
    "orderId": "string",
    "status": "string",
    "lastUpdated": "string",
    "trackingDetails": object
  }
  ```

## KYC

### Submit KYC
- **Endpoint**: `/api/kyc/submit`
- **Method**: POST
- **Description**: Submit KYC documents for verification
- **Request Body**:
  ```json
  {
    "businessName": "string",
    "registrationNumber": "string",
    "taxId": "string",
    "documents": [
      {
        "type": "string",
        "url": "string"
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "message": "KYC submitted successfully",
    "kycId": "string"
  }
  ```

### Get KYC Status
- **Endpoint**: `/api/kyc/status`
- **Method**: GET
- **Description**: Get current status of KYC verification
- **Response**:
  ```json
  {
    "status": "string",
    "lastUpdated": "string",
    "remarks": "string"
  }
  ```

## Error Responses
All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "string",
  "message": "string"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting
- All endpoints are rate limited
- Default limit: 5 requests per minute per IP
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Time until limit resets

## Authentication
- All endpoints except login and register require JWT token
- Include token in Authorization header:
  ```
  Authorization: Bearer <token>
  ```
- Tokens expire after 24 hours
- Refresh tokens are provided for extended sessions

## Versioning
- Current API version: v1
- Include version in URL: `/api/v1/...`
- Breaking changes will be released in new versions 
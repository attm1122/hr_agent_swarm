# API Documentation

## Authentication

All API routes except `/auth/*` require authentication via Supabase session.

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "password"
}
```

### OAuth Callback
```http
GET /auth/callback?code=xxx&next=/dashboard
```

---

## API Routes

### Health Check
```http
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-12T10:30:00.000Z",
  "version": "0.1.0"
}
```

---

### Swarm API

Process natural language queries through the AI agent swarm.

```http
POST /api/swarm
Content-Type: application/json
Authorization: Bearer <token>

{
  "intent": "leave_balance_check",
  "query": "How much leave do I have left?",
  "payload": {},
  "context": {
    "userId": "xxx",
    "tenantId": "xxx",
    "role": "employee"
  }
}
```

Response:
```json
{
  "agentType": "leave",
  "intent": "leave_balance_check",
  "result": {
    "answer": "You have 15 days of annual leave remaining",
    "data": {
      "annual": 15,
      "sick": 8,
      "personal": 2
    }
  },
  "executionTimeMs": 245,
  "auditId": "xxx"
}
```

---

### Export API

#### Request Export
```http
POST /api/export
Content-Type: application/json
Authorization: Bearer <token>

{
  "reportType": "employee_list",
  "format": "csv",
  "filters": {
    "department": "Engineering",
    "status": "active"
  }
}
```

#### Approve Export (Managers Only)
```http
POST /api/export/approval
Content-Type: application/json
Authorization: Bearer <token>

{
  "requestId": "xxx",
  "action": "approve",
  "reason": "Approved for quarterly review"
}
```

---

### Admin API

#### Get Config
```http
GET /api/admin/config
Authorization: Bearer <token>
```

#### Update Config
```http
POST /api/admin/config
Content-Type: application/json
Authorization: Bearer <token>

{
  "key": "value"
}
```

#### Get Observability Data
```http
GET /api/admin/observability?metric=agent_runs&timeRange=24h
Authorization: Bearer <token>
```

---

## Database Schema

### Core Tables

#### employees
```sql
id: uuid PRIMARY KEY
tenant_id: uuid REFERENCES tenants(id)
email: text UNIQUE
first_name: text
last_name: text
employee_number: text UNIQUE
hire_date: date
status: enum ('active', 'inactive', 'on_leave', 'terminated')
employment_type: enum ('full_time', 'part_time', 'contract')
team_id: uuid REFERENCES teams(id)
position_id: uuid REFERENCES positions(id)
manager_id: uuid REFERENCES employees(id)
created_at: timestamptz
updated_at: timestamptz
```

#### leave_requests
```sql
id: uuid PRIMARY KEY
tenant_id: uuid
employee_id: uuid REFERENCES employees(id)
leave_type: enum ('annual', 'sick', 'personal', 'parental')
start_date: date
end_date: date
days_requested: integer
reason: text
status: enum ('pending', 'approved', 'rejected')
approved_by: uuid REFERENCES employees(id)
approved_at: timestamptz
created_at: timestamptz
updated_at: timestamptz
```

#### workflows
```sql
id: uuid PRIMARY KEY
tenant_id: uuid
workflow_type: text
entity_type: text
entity_id: text
status: enum ('pending', 'in_progress', 'completed', 'rejected')
initiated_by: uuid
current_step: integer
total_steps: integer
context: jsonb
created_at: timestamptz
updated_at: timestamptz
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "Missing required field: employee_id"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "message": "Please log in to access this resource"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied",
  "message": "You do not have permission to perform this action"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Employee with id 'xxx' not found"
}
```

---

## Rate Limiting

API endpoints have rate limits:

- **Public endpoints**: 100 requests/minute
- **Authenticated endpoints**: 1000 requests/minute
- **Admin endpoints**: 100 requests/minute

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1649760000
```

---

## Pagination

List endpoints support pagination:

```http
GET /api/employees?page=1&limit=20
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Webhooks

### Event Types

- `employee.created`
- `employee.updated`
- `leave_request.submitted`
- `leave_request.approved`
- `workflow.step_completed`
- `workflow.completed`

### Webhook Payload
```json
{
  "event": "employee.created",
  "timestamp": "2026-04-12T10:30:00.000Z",
  "data": {
    "id": "xxx",
    "email": "user@company.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "tenant_id": "xxx"
}
```

---

## SDK Usage

### JavaScript/TypeScript
```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Query employees
const { data, error } = await supabase
  .from('employees')
  .select('*')
  .eq('status', 'active');

// Create leave request
const { data, error } = await supabase
  .from('leave_requests')
  .insert({
    employee_id: user.id,
    leave_type: 'annual',
    start_date: '2026-05-01',
    end_date: '2026-05-05',
    days_requested: 5
  });
```

### cURL Examples
```bash
# Get employees
curl -H "Authorization: Bearer $TOKEN" \
  https://ycrvhfgcdygdjqzlglgt.supabase.co/rest/v1/employees \
  -H "apikey: $ANON_KEY"

# Create leave request
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"leave_type":"annual","start_date":"2026-05-01"}' \
  https://ycrvhfgcdygdjqzlglgt.supabase.co/rest/v1/leave_requests
```

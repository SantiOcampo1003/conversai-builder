# Development Standards - ConversAI Builder

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Query (TanStack Query) v5
- **Forms**: React Hook Form + Zod
- **Routing**: React Router v6
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Code Standards

### 1. Forms - ALWAYS use React Hook Form + Zod

All forms MUST be managed with React Hook Form and validated with Zod. Never use native HTML form validation.

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
})

type FormData = z.infer<typeof formSchema>

const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    name: '',
    email: '',
  },
})

const onSubmit = async (values: FormData) => {
  // Handle submission
}

// In JSX
<form onSubmit={form.handleSubmit(onSubmit)}>
  <Input {...form.register('email')} />
  {form.formState.errors.email && (
    <p className="text-xs text-red-600">
      {form.formState.errors.email.message}
    </p>
  )}
</form>
```

**Conditional validation with refine:**
```typescript
const schema = z.object({
  type: z.enum(['bug', 'review', 'other']),
  subject: z.string(),
  message: z.string(),
}).refine(
  (data) => {
    if (data.type === 'review') return true
    return data.subject.trim().length > 0
  },
  { message: 'Subject is required', path: ['subject'] }
)
```

**Watching values:**
```typescript
const currentType = form.watch('type')
// Use currentType in render logic
```

**Setting values programmatically:**
```typescript
form.setValue('type', 'bug')
form.reset() // Reset to default values
```

### 2. Data Fetching - React Query (TanStack Query)

Use React Query for ALL data fetching, caching, and server state management.

**Query patterns:**
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'

// Basic query
const { data, isLoading, error } = useQuery({
  queryKey: ['users', userId],
  queryFn: async () => {
    const { data } = await supabase.from('users').select('*').eq('id', userId)
    return data
  },
  enabled: !!userId,
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,  // Always refetch when returning to tab
  refetchOnReconnect: true,    // Always refetch when reconnecting
})

// Mutation with cache invalidation
const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: async (newUser) => {
    const { data } = await supabase.from('users').insert(newUser)
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
  },
})
```

**Caching strategy:**
- Static/rarely changing data (clients, agents): `staleTime: 5 * 60 * 1000` (5 min)
- Dynamic data (metrics, stats): `staleTime: 30 * 1000` (30 sec)
- Real-time data: Use Supabase Realtime subscriptions

**Always include these options:**
```typescript
{
  refetchOnWindowFocus: true,  // Auto-refetch when user returns to tab
  refetchOnReconnect: true,    // Auto-refetch when internet reconnects
}
```

**Optional auto-refresh (only for real-time sections like WhatsApp):**
```typescript
{
  refetchInterval: 60000,  // Auto-refetch every 60 seconds
}
```

### 3. Database - Naming Conventions

**IMPORTANT: All database types/enums MUST be in English for standardization**

```sql
-- ✅ CORRECT
CREATE TYPE feedback_type AS ENUM ('bug', 'feedback', 'review', 'feature_request', 'other');

-- ❌ WRONG
CREATE TYPE feedback_type AS ENUM ('problema', 'feedback', 'review', 'mejora', 'otro');
```

**Table naming:**
- Use snake_case: `user_feedback`, `client_members`, `token_balances`
- Plural for collection tables: `users`, `agents`, `tokens`
- Singular for relationship/config tables: `token_balance`, `client_config`

**Column naming:**
- snake_case: `user_id`, `created_at`, `available_tokens`
- Always use `id` as primary key (uuid)
- Foreign keys: `{table}_id` (e.g., `user_id`, `client_id`)
- Timestamps: `created_at`, `updated_at`, `deleted_at`

### 4. Authentication & Permissions

**Row Level Security (RLS) is MANDATORY on all tables**

**Permission system:**
```typescript
// Roles
type UserRole = 'admin' | 'member' | 'viewer'

// Permissions per section
type Permission = 'view' | 'create' | 'edit' | 'delete'

// Check permissions in components
const { data: permissions } = useQuery({
  queryKey: ['permissions', userId, section],
  queryFn: async () => {
    // Fetch from member_permissions table
  },
})

// Admin always has full access
if (userRole === 'admin') {
  // Grant all permissions
}
```

**Tables involved:**
- `client_members` - Associates auth users with clients
- `member_permissions` - Granular permissions per section
- Always check `status = 'active'` when querying memberships

### 5. TypeScript Standards

**Type definitions:**
```typescript
// Use interfaces for objects
interface User {
  id: string
  email: string
  name?: string
}

// Use type for unions/primitives
type UserRole = 'admin' | 'member' | 'viewer'
type SectionId = 'overview' | 'agents' | 'tokens'
```

**Avoid any, use unknown:**
```typescript
// ❌ WRONG
const data: any = await fetchData()

// ✅ CORRECT
const data: unknown = await fetchData()
if (isValidData(data)) {
  // Type narrowing
}
```

### 6. Components - Structure

**File organization:**
```
src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── dashboard/    # Dashboard-specific components
│   └── FeedbackDialog.tsx  # Shared components
├── pages/            # Route components
├── context/          # React contexts
├── hooks/            # Custom hooks
├── lib/              # Utilities (supabase, utils)
└── types/            # TypeScript types
```

**Component structure:**
```typescript
// 1. Imports
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

// 2. Types/Interfaces
interface Props {
  userId: string
}

// 3. Constants (outside component)
const CACHE_TIME = 5 * 60 * 1000

// 4. Component
export function MyComponent({ userId }: Props) {
  // 4.1 Hooks
  const { data } = useQuery(...)
  const [state, setState] = useState()

  // 4.2 Functions
  const handleClick = () => {}

  // 4.3 Effects
  useEffect(() => {}, [])

  // 4.4 Render
  return <div>...</div>
}
```

### 7. Styling - Tailwind + shadcn/ui

**Always use Tailwind utilities, avoid inline styles:**
```typescript
// ✅ CORRECT
<div className="flex items-center gap-4 p-6 rounded-lg bg-card">

// ❌ WRONG
<div style={{ display: 'flex', padding: '24px' }}>
```

**Use cn() helper for conditional classes:**
```typescript
import { cn } from '@/lib/utils'

<Button className={cn(
  "rounded-full h-14",
  isExpanded ? "px-6 gap-2" : "w-14 px-0"
)} />
```

**Color system:**
- Use semantic colors: `bg-primary`, `text-foreground`, `border-border`
- Avoid hard-coded colors: Use `text-red-600` only for errors
- Gradients: `bg-gradient-to-br from-primary to-primary/90`

### 8. Comments - Only When Necessary

**DO NOT add comments for obvious code:**
```typescript
// ❌ WRONG - Obvious
// Set the user name
setUserName(name)

// Increment counter
count++

// ✅ CORRECT - Explains complex logic
// Invalidate cache before redirect to prevent stale data on return
await queryClient.invalidateQueries({ queryKey: ['tokens-data'] })
window.location.href = data.checkoutUrl

// ✅ CORRECT - Documents important business rules
// Rating is only required for review type feedback
rating: formik.values.rating > 0 ? formik.values.rating : null
```

**When to add comments:**
- Complex business logic that isn't obvious
- Workarounds for bugs/limitations
- Important security considerations
- Non-obvious performance optimizations

### 9. Error Handling

**Always handle errors gracefully:**
```typescript
try {
  const { data, error } = await supabase.from('users').select()
  if (error) throw error
  return data
} catch (err) {
  console.error('Error fetching users:', err)
  toast({
    title: 'Error',
    description: 'Failed to load users. Please try again.',
    variant: 'destructive',
  })
}
```

**Never show technical errors to users:**
- Log full error to console
- Show user-friendly message in UI

### 10. Supabase Patterns

**Query patterns:**
```typescript
// Single record with relations
const { data, error } = await supabase
  .from('agents')
  .select(`
    *,
    client:clients(name, email)
  `)
  .eq('id', agentId)
  .single()

// Filtering and ordering
const { data } = await supabase
  .from('chats')
  .select('*')
  .eq('agent_id', agentId)
  .gte('created_at', startDate)
  .lte('created_at', endDate)
  .order('created_at', { ascending: false })
  .limit(100)

// Insert with return
const { data, error } = await supabase
  .from('feedback')
  .insert({ ... })
  .select()
  .single()
```

### 11. Environment Variables

**Always use typed environment variables:**
```typescript
// vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_N8N_CHAT_WEBHOOK: string
}

// Usage
const webhookUrl = import.meta.env.VITE_N8N_CHAT_WEBHOOK
```

**Naming convention:**
- Vite vars: `VITE_{NAME}`
- All caps with underscores: `VITE_API_URL`

### 12. Performance Best Practices

**1. Memoization:**
```typescript
const expensiveValue = useMemo(() => computeExpensive(data), [data])
const handleClick = useCallback(() => {}, [])
```

**2. Lazy loading:**
```typescript
const HeavyComponent = lazy(() => import('./HeavyComponent'))
```

**3. Virtualization for long lists:**
- Use `react-window` or similar for 100+ items

**4. Debouncing:**
```typescript
const debouncedSearch = useMemo(
  () => debounce((value) => search(value), 300),
  []
)
```

## Testing (Future)

When adding tests, use:
- Vitest for unit tests
- React Testing Library for components
- Playwright for E2E

## Git Workflow

**Commit message format:**
```
feat: add user feedback system
fix: resolve hover bug on feedback button
refactor: migrate forms to Formik
docs: update development standards
```

**Branch naming:**
- Features: `feature/user-feedback`
- Fixes: `fix/hover-bug`
- Refactor: `refactor/formik-migration`

## Common Pitfalls to Avoid

1. ❌ Never use `any` type
2. ❌ Never bypass RLS with service_role in frontend
3. ❌ Never store secrets in code or .env files (use .env.local)
4. ❌ Never mutate state directly
5. ❌ Never use native form validation (always React Hook Form + Zod)
6. ❌ Never fetch data without React Query
7. ❌ Never use Spanish in database types/enums
8. ❌ Never commit commented-out code
9. ❌ Never use inline styles (use Tailwind)
10. ❌ Never ignore TypeScript errors

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)

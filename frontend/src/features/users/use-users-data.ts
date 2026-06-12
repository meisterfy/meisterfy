import { useQuery } from '@tanstack/react-query'
import {
  listTenantUsers,
  listRoles,
  type AdminUser,
  type AdminRole,
} from '@/lib/api/admin-users'
import { qk, fallbackQuery } from '@/lib/query'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUsersData({ tenant }: { tenant: string }): {
  users: AdminUser[]
  inactiveUsers: AdminUser[]
  roles: AdminRole[]
  isLoading: boolean
  refetch: () => void
} {
  const usersQuery = useQuery({
    queryKey: qk.tenantUsers(tenant, true),
    queryFn: () => fallbackQuery(() => listTenantUsers(tenant, true), []),
  })

  const inactiveQuery = useQuery({
    queryKey: qk.tenantUsers(tenant, false),
    queryFn: () => fallbackQuery(() => listTenantUsers(tenant, false), []),
  })

  const rolesQuery = useQuery({
    queryKey: qk.roles,
    queryFn: () => fallbackQuery(() => listRoles(), []),
  })

  return {
    users: usersQuery.data ?? [],
    inactiveUsers: inactiveQuery.data ?? [],
    roles: rolesQuery.data ?? [],
    isLoading:
      usersQuery.isLoading || inactiveQuery.isLoading || rolesQuery.isLoading,
    refetch: () => {
      usersQuery.refetch()
      inactiveQuery.refetch()
      rolesQuery.refetch()
    },
  }
}

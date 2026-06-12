import { useState, useEffect } from 'react'
import { listRoles, listPermissions } from '@/lib/api/admin-users'
import type { AdminRole, AdminPermission } from '@/lib/api/admin-users'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseRolesDataResult {
  roles: AdminRole[]
  setRoles: React.Dispatch<React.SetStateAction<AdminRole[]>>
  allPermissions: AdminPermission[]
  isLoading: boolean
}

export function useRolesData(): UseRolesDataResult {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [allPermissions, setAllPermissions] = useState<AdminPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      listRoles().catch((): AdminRole[] => []),
      listPermissions().catch((): AdminPermission[] => []),
    ]).then(([r, p]) => {
      setRoles(r)
      setAllPermissions(p)
      setIsLoading(false)
    })
  }, [])

  return { roles, setRoles, allPermissions, isLoading }
}

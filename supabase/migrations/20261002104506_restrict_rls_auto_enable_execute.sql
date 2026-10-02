-- Internal DDL event trigger; application clients do not invoke this function.
-- Keep its owner/service-role permissions and the ensure_rls trigger unchanged.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

import { useAuth } from './useAuth'

export function useLocal() {
  const { usuario } = useAuth()
  return {
    localId: usuario?.local_id ?? null,
    rol: usuario?.rol ?? null,
    nombre: usuario?.nombre ?? '',
  }
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OFFER_LABELS, STATUS_LABELS, DEVICE_LABELS, PLATFORM_LABELS } from './labels'

export interface Individual {
  id: string
  createdAt: string
  isLive: boolean
  adRef: string
  country: string
  device: string | null
  platform: string | null
  ip: string | null
  lastStep: string
  stepNum: number | null
  orderStatus: string | null
  productCode: string | null
  buyerName: string | null
  buyerEmail: string | null
  totalAmount: number | null
  currency: string | null
}

// Tabela "Todos los individuos" com seleção múltipla (checkbox por linha +
// "selecionar tudo") pra apagar vários leads falsos/de teste de uma vez,
// igual ao painel do Encontro com Jesus. Guarda o ADMIN_SECRET no
// sessionStorage depois do 1º acerto pra não pedir de novo na mesma sessão.
export function IndividualsTable({ individuals }: { individuals: Individual[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)

  const allSelected = individuals.length > 0 && selected.size === individuals.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(individuals.map((i) => i.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!window.confirm(`¿Eliminar ${selected.size} sesión(es)? No se puede deshacer.`)) return

    let secret = sessionStorage.getItem('quiz_funnel_admin_secret')
    if (!secret) {
      secret = window.prompt('Código de administrador:')
      if (!secret) return
    }

    setPending(true)
    try {
      const res = await fetch('/api/admin/delete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: Array.from(selected), secret }),
      })

      if (res.status === 401) {
        sessionStorage.removeItem('quiz_funnel_admin_secret')
        alert('Código incorrecto.')
        return
      }
      if (!res.ok) {
        alert('Error al eliminar las sesiones.')
        return
      }

      sessionStorage.setItem('quiz_funnel_admin_secret', secret)
      setSelected(new Set())
      router.refresh()
    } catch {
      alert('Error de red.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Todos los individuos</p>
          <p className="text-xs text-muted-foreground">Una fila por sesión del período · {individuals.length} en total</p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={pending}
            className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Eliminando…' : `Eliminar ${selected.size} seleccionado(s)`}
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase text-muted-foreground">
            <th className="px-4 py-2 font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-3.5 w-3.5 rounded border-border accent-red-600"
                aria-label="Seleccionar todos"
              />
            </th>
            <th className="px-4 py-2 font-medium">ID</th>
            <th className="px-4 py-2 font-medium">Fecha</th>
            <th className="px-4 py-2 font-medium">Vivo</th>
            <th className="px-4 py-2 font-medium">Anuncio</th>
            <th className="px-4 py-2 font-medium">País</th>
            <th className="px-4 py-2 font-medium">Dispositivo</th>
            <th className="px-4 py-2 font-medium">Sistema</th>
            <th className="px-4 py-2 font-medium">Último paso</th>
            <th className="px-4 py-2 font-medium">Pedido</th>
            <th className="px-4 py-2 font-medium">Producto</th>
            <th className="px-4 py-2 font-medium">Comprador</th>
            <th className="px-4 py-2 font-medium">IP</th>
            <th className="px-4 py-2 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {individuals.length === 0 && (
            <tr><td colSpan={14} className="px-4 py-3 text-muted-foreground">Sin sesiones en el período.</td></tr>
          )}
          {individuals.map((ind) => (
            <tr
              key={ind.id}
              className={['transition-colors', selected.has(ind.id) ? 'bg-red-50' : 'hover:bg-muted/30'].join(' ')}
            >
              <td className="px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(ind.id)}
                  onChange={() => toggleOne(ind.id)}
                  className="h-3.5 w-3.5 rounded border-border accent-red-600"
                  aria-label={`Seleccionar sesión ${ind.id.slice(0, 8)}`}
                />
              </td>
              <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground" title={ind.id}>
                {ind.id.slice(0, 8)}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(ind.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                })}
              </td>
              <td className="px-4 py-2.5">
                {ind.isLive && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                    Vivo
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs">{ind.adRef}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{ind.country}</td>
              <td className="px-4 py-2.5 text-xs">{ind.device ? (DEVICE_LABELS[ind.device] ?? ind.device) : '—'}</td>
              <td className="px-4 py-2.5 text-xs">{ind.platform ? (PLATFORM_LABELS[ind.platform] ?? ind.platform) : '—'}</td>
              <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                {ind.stepNum !== null && <span className="mr-1 font-mono text-[10px] text-muted-foreground/70">{ind.stepNum}·</span>}
                {ind.lastStep}
              </td>
              <td className="px-4 py-2.5 text-xs">{ind.orderStatus ? (STATUS_LABELS[ind.orderStatus] ?? ind.orderStatus) : '—'}</td>
              <td className="px-4 py-2.5 text-xs">{ind.productCode ? (OFFER_LABELS[ind.productCode] ?? ind.productCode) : '—'}</td>
              <td className="px-4 py-2.5 text-xs">
                {ind.buyerEmail ? (
                  <>
                    <p className="font-medium">{ind.buyerName?.trim() || 'Cliente'}</p>
                    <p className="text-[10px] text-muted-foreground">{ind.buyerEmail}</p>
                  </>
                ) : '—'}
              </td>
              <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{ind.ip ?? '—'}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">
                {ind.totalAmount !== null ? `${ind.currency} ${ind.totalAmount}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

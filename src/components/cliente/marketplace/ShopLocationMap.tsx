import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Navigation } from 'lucide-react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { supabase } from '../../../lib/supabase'
import { buildAddressSignature, buildReadableAddress, hasMinimumAddressForGeocoding, normalizeCep } from '../../../lib/location'
import { DirectionsMapModal } from './DirectionsMapModal'
import 'leaflet/dist/leaflet.css'
import type { Tables } from '../../../types/database'

type Shop = Pick<
  Tables<'shops'>,
  | 'id'
  | 'name'
  | 'address'
  | 'cep'
  | 'address_street'
  | 'address_number'
  | 'neighborhood'
  | 'city'
  | 'state'
  | 'complement'
  | 'latitude'
  | 'longitude'
>

interface ShopLocationMapProps {
  shop: Shop
}

const markerIcon = divIcon({
  className: 'shop-location-marker',
  html: '<span class="shop-location-marker-dot"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
})

function InlineMapRuntimeEffects() {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize()
    const frame = window.requestAnimationFrame(() => map.invalidateSize())

    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [map])

  return null
}

function parseCoordinate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) return null
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function extractFunctionStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const errorRecord = error as {
    status?: number
    context?: { status?: number }
  }
  const status = Number(errorRecord.context?.status) || Number(errorRecord.status)
  return Number.isFinite(status) ? status : null
}

export function ShopLocationMap({ shop }: ShopLocationMapProps) {
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [resolvingCoords, setResolvingCoords] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [resolveAttempt, setResolveAttempt] = useState(0)
  const geocodeAttemptRef = useRef('')

  const directCoords = useMemo(() => {
    const lat = parseCoordinate(shop.latitude)
    const lng = parseCoordinate(shop.longitude)
    return lat !== null && lng !== null ? { lat, lng } : null
  }, [shop.latitude, shop.longitude])

  const coords = directCoords || resolvedCoords

  const readableAddress = useMemo(
    () =>
      buildReadableAddress({
        cep: shop.cep,
        address_street: shop.address_street,
        address_number: shop.address_number,
        neighborhood: shop.neighborhood,
        city: shop.city,
        state: shop.state,
        complement: shop.complement,
        address: shop.address,
      }),
    [
      shop.address,
      shop.address_number,
      shop.address_street,
      shop.cep,
      shop.city,
      shop.complement,
      shop.neighborhood,
      shop.state,
    ]
  )

  useEffect(() => {
    geocodeAttemptRef.current = ''
    setResolvedCoords(null)
    setResolveError('')
    setResolvingCoords(false)
  }, [shop.id])

  useEffect(() => {
    if (directCoords) {
      setResolvedCoords(null)
      setResolveError('')
      setResolvingCoords(false)
      return
    }

    const addressPayload = {
      cep: normalizeCep(shop.cep),
      address_street: shop.address_street,
      address_number: shop.address_number,
      neighborhood: shop.neighborhood,
      city: shop.city,
      state: shop.state?.toUpperCase() || null,
      complement: shop.complement,
      address: shop.address,
    }

    const minimumAddressAvailable = hasMinimumAddressForGeocoding(addressPayload)
    if (!shop.id && !minimumAddressAvailable) {
      setResolveError('Localização ainda não configurada.')
      setResolvingCoords(false)
      return
    }

    const signature = `${shop.id}|${buildAddressSignature(addressPayload)}|${resolveAttempt}`
    if (geocodeAttemptRef.current === signature) return
    geocodeAttemptRef.current = signature

    let active = true
    setResolvingCoords(true)
    setResolveError('')

    async function resolveCoords() {
      const { data, error } = await supabase.functions.invoke('geocode-shop-location', {
        body: {
          shopId: shop.id,
          cep: addressPayload.cep || null,
          city: addressPayload.city || null,
          state: addressPayload.state || null,
          neighborhood: addressPayload.neighborhood || null,
          address_street: addressPayload.address_street || null,
          address_number: addressPayload.address_number || null,
          complement: addressPayload.complement || null,
          persist: false,
        },
      })

      if (!active) return

      if (error) {
        const status = extractFunctionStatus(error)
        if (status === 422) {
          setResolveError('Não foi possível localizar esse endereço no mapa.')
        } else {
          setResolveError('Não foi possível carregar a localização agora.')
        }
        return
      }

      const payload = (data || {}) as Record<string, unknown>
      const lat = parseCoordinate(payload.latitude)
      const lng = parseCoordinate(payload.longitude)
      if (lat === null || lng === null) {
        setResolveError('A localização retornou coordenadas inválidas.')
        return
      }

      setResolvedCoords({ lat, lng })
      setResolveError('')
    }

    void resolveCoords().finally(() => {
      if (!active) return
      setResolvingCoords(false)
    })

    return () => {
      active = false
    }
  }, [
    directCoords,
    shop.id,
    shop.address,
    shop.address_number,
    shop.address_street,
    shop.cep,
    shop.city,
    shop.complement,
    shop.neighborhood,
    shop.state,
    resolveAttempt,
  ])

  const googleSearchUrl = useMemo(() => {
    const query = encodeURIComponent(readableAddress)
    return `https://www.google.com/maps/search/?api=1&query=${query}`
  }, [readableAddress])

  const wazeUrl = useMemo(() => {
    if (!coords) return ''
    return `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
  }, [coords])

  const showInlineMap = Boolean(coords) && !directionsOpen

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Localização</h2>

      {showInlineMap ? (
        <div className="relative h-52 overflow-hidden rounded-xl border border-[var(--color-border)] sm:h-56">
          <MapContainer
            key={`inline-map-${shop.id}`}
            center={[coords!.lat, coords!.lng]}
            zoom={16}
            dragging={false}
            touchZoom={false}
            doubleClickZoom={false}
            boxZoom={false}
            keyboard={false}
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
            className="shop-location-inline-map pointer-events-none h-full w-full"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[coords!.lat, coords!.lng]} icon={markerIcon} />
            <InlineMapRuntimeEffects />
          </MapContainer>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/30 via-transparent to-transparent px-3 py-2 text-[11px] font-medium text-white/85">
            Prévia do mapa
          </div>
        </div>
      ) : coords ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-center text-sm text-[var(--color-text-muted)]">
          Mapa expandido aberto.
        </div>
      ) : resolvingCoords ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-center text-sm text-[var(--color-text-muted)]">
          Carregando localização...
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-center text-sm text-[var(--color-text-muted)]">
          Localização ainda não configurada.
        </div>
      )}

      <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text)]">
        {readableAddress}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => setDirectionsOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Navigation size={16} />
          Como chegar
        </button>

        {coords ? (
          <a
            href={wazeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <ExternalLink size={16} />
            Abrir no Waze
          </a>
        ) : (
          <a
            href={googleSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <ExternalLink size={16} />
            Ver no Google Maps
          </a>
        )}
      </div>

      {!coords && (
        <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            {resolveError || 'Localização ainda não configurada para traçar rota. Configure a localização no painel da barbearia.'}
          </p>
          {!resolvingCoords && (
            <button
              onClick={() => setResolveAttempt((value) => value + 1)}
              className="mt-2 inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              Tentar localizar novamente
            </button>
          )}
        </div>
      )}

      <DirectionsMapModal
        open={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        shopName={shop.name}
        shopAddress={readableAddress}
        shopCoords={coords}
      />
    </section>
  )
}

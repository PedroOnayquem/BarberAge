import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Navigation } from 'lucide-react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import {
  buildReadableAddress,
  formatGeocodeProviderLabel,
  formatLocationPrecisionLabel,
  getLocationPreviewZoom,
  normalizeAndRepairCoordinates,
} from '../../../lib/location'
import { DirectionsMapModal } from './DirectionsMapModal'
import 'leaflet/dist/leaflet.css'
import type { Tables } from '../../../types/database'

type Shop = Pick<
  Tables<'shops'>,
  | 'id'
  | 'name'
  | 'address'
  | 'formatted_address'
  | 'cep'
  | 'address_street'
  | 'address_number'
  | 'neighborhood'
  | 'city'
  | 'state'
  | 'complement'
  | 'latitude'
  | 'longitude'
  | 'geocode_precision'
  | 'geocode_provider'
  | 'geocoded_at'
>

interface ShopLocationMapProps {
  shop: Shop
}

const INLINE_MAP_PRIMARY_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const INLINE_MAP_FALLBACK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

const markerIcon = divIcon({
  className: 'shop-location-marker',
  html: '<span class="shop-location-marker-dot"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
})

function formatGeocodedAt(value: string | null) {
  const normalized = (value || '').trim()
  if (!normalized) return ''
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString('pt-BR')
}

function InlineMapRuntimeEffects({
  center,
  zoom,
}: {
  center: [number, number]
  zoom: number
}) {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize()
    map.setView(center, zoom, { animate: false })
    const frame = window.requestAnimationFrame(() => map.invalidateSize())

    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [center, map, zoom])

  return null
}

export function ShopLocationMap({ shop }: ShopLocationMapProps) {
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const [tileUrl, setTileUrl] = useState(INLINE_MAP_PRIMARY_TILE_URL)
  const [usingFallbackTiles, setUsingFallbackTiles] = useState(false)
  const [tilesUnavailable, setTilesUnavailable] = useState(false)

  const normalizedCoords = useMemo(
    () => normalizeAndRepairCoordinates(shop.latitude, shop.longitude),
    [shop.latitude, shop.longitude]
  )

  const coords = useMemo(() => {
    if (!normalizedCoords) return null
    return { lat: normalizedCoords.latitude, lng: normalizedCoords.longitude }
  }, [normalizedCoords])

  useEffect(() => {
    setTileUrl(INLINE_MAP_PRIMARY_TILE_URL)
    setUsingFallbackTiles(false)
    setTilesUnavailable(false)
  }, [shop.id, coords?.lat, coords?.lng])

  useEffect(() => {
    if (!import.meta.env.DEV || !normalizedCoords?.wasSwapped) return
    console.warn('[shop-location-map] lat/lng invertidos detectados e corrigidos para exibição', {
      shopId: shop.id,
      original: { latitude: shop.latitude, longitude: shop.longitude },
      corrected: { latitude: normalizedCoords.latitude, longitude: normalizedCoords.longitude },
    })
  }, [
    normalizedCoords?.latitude,
    normalizedCoords?.longitude,
    normalizedCoords?.wasSwapped,
    shop.id,
    shop.latitude,
    shop.longitude,
  ])

  const readableAddress = useMemo(() => buildReadableAddress({
    cep: shop.cep,
    address_street: shop.address_street,
    address_number: shop.address_number,
    neighborhood: shop.neighborhood,
    city: shop.city,
    state: shop.state,
    complement: shop.complement,
    address: shop.address,
  }), [
    shop.address,
    shop.address_number,
    shop.address_street,
    shop.cep,
    shop.city,
    shop.complement,
    shop.neighborhood,
    shop.state,
  ])

  const geocodedAddress = (shop.formatted_address || '').trim()
  const searchAddress = geocodedAddress || readableAddress
  const previewZoom = getLocationPreviewZoom(shop.geocode_precision)
  const geocodeProviderLabel = formatGeocodeProviderLabel(shop.geocode_provider)
  const precisionLabel = formatLocationPrecisionLabel(shop.geocode_precision, shop.geocode_provider)
  const geocodedAtLabel = formatGeocodedAt(shop.geocoded_at)
  const showGeocodedAddressDetails = Boolean(geocodedAddress) && geocodedAddress !== readableAddress
  const showMapMetadata =
    Boolean(coords) ||
    Boolean(geocodedAddress) ||
    Boolean(shop.geocode_precision) ||
    Boolean(shop.geocode_provider) ||
    Boolean(shop.geocoded_at)

  const googleSearchUrl = useMemo(() => {
    const query = encodeURIComponent(searchAddress)
    return `https://www.google.com/maps/search/?api=1&query=${query}`
  }, [searchAddress])

  const wazeUrl = useMemo(() => {
    if (!coords) return ''
    return `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
  }, [coords])

  const showInlineMap = Boolean(coords) && !directionsOpen && !tilesUnavailable

  function handleTileError() {
    if (tileUrl !== INLINE_MAP_FALLBACK_TILE_URL) {
      setTileUrl(INLINE_MAP_FALLBACK_TILE_URL)
      setUsingFallbackTiles(true)
      return
    }
    setTilesUnavailable(true)
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Localização</h2>

      {showInlineMap ? (
        <div className="relative h-52 overflow-hidden rounded-xl border border-[var(--color-border)] sm:h-56">
          <MapContainer
            key={`inline-map-${shop.id}`}
            center={[coords!.lat, coords!.lng]}
            zoom={previewZoom}
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
              key={tileUrl}
              attribution="&copy; OpenStreetMap contributors"
              url={tileUrl}
              eventHandlers={{ tileerror: handleTileError }}
            />
            <Marker position={[coords!.lat, coords!.lng]} icon={markerIcon} />
            <InlineMapRuntimeEffects center={[coords!.lat, coords!.lng]} zoom={previewZoom} />
          </MapContainer>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent px-3 py-2 text-[11px] font-medium text-white/90">
            {usingFallbackTiles ? 'Prévia do mapa com camada alternativa' : 'Prévia do mapa'}
          </div>
        </div>
      ) : coords ? (
        <div className="flex h-52 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-center text-sm text-[var(--color-text-muted)] sm:h-56">
          {directionsOpen
            ? 'Mapa expandido aberto.'
            : 'Não foi possível carregar a prévia do mapa aqui. Use "Como chegar" ou abra no app de navegação.'}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-center text-sm text-[var(--color-text-muted)]">
          Localização não configurada.
        </div>
      )}

      <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text)]">
        {readableAddress}
      </div>

      {showMapMetadata && (
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            {precisionLabel}
            {geocodeProviderLabel ? ` • ${geocodeProviderLabel}` : ''}
            {geocodedAtLabel ? ` • atualizado em ${geocodedAtLabel}` : ''}
          </p>
          {showGeocodedAddressDetails && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Endereço confirmado pelo provedor: {geocodedAddress}
            </p>
          )}
          {tilesUnavailable && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              A prévia do minimapa falhou nesta conexão, mas a rota externa continua disponível normalmente.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => setDirectionsOpen(true)}
          className="brand-gradient-bg inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
        >
          <Navigation size={16} />
          Como chegar
        </button>

        {coords ? (
          <a
            href={wazeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-white/[0.09]"
          >
            <ExternalLink size={16} />
            Abrir no Waze
          </a>
        ) : (
          <a
            href={googleSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-white/[0.09]"
          >
            <ExternalLink size={16} />
            Abrir no Google Maps
          </a>
        )}
      </div>

      {!coords && (
        <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            Revise o endereço nas configurações da empresa para salvar latitude e longitude e habilitar rota interna.
          </p>
        </div>
      )}

      <DirectionsMapModal
        open={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        shopId={shop.id}
        shopName={shop.name}
        shopAddress={readableAddress}
        shopFormattedAddress={geocodedAddress || null}
        shopCoords={coords}
      />
    </section>
  )
}

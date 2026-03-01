import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Navigation } from 'lucide-react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { buildReadableAddress, normalizeAndRepairCoordinates } from '../../../lib/location'
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

export function ShopLocationMap({ shop }: ShopLocationMapProps) {
  const [directionsOpen, setDirectionsOpen] = useState(false)

  const normalizedCoords = useMemo(
    () => normalizeAndRepairCoordinates(shop.latitude, shop.longitude),
    [shop.latitude, shop.longitude]
  )

  const coords = useMemo(() => {
    if (!normalizedCoords) return null
    return { lat: normalizedCoords.latitude, lng: normalizedCoords.longitude }
  }, [normalizedCoords])

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

  const readableAddress = useMemo(() => {
    const formattedAddress = (shop.formatted_address || '').trim()
    if (formattedAddress) return formattedAddress

    return buildReadableAddress({
      cep: shop.cep,
      address_street: shop.address_street,
      address_number: shop.address_number,
      neighborhood: shop.neighborhood,
      city: shop.city,
      state: shop.state,
      complement: shop.complement,
      address: shop.address,
    })
  }, [
    shop.address,
    shop.address_number,
    shop.address_street,
    shop.cep,
    shop.city,
    shop.complement,
    shop.formatted_address,
    shop.neighborhood,
    shop.state,
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
              attribution="&copy; OpenStreetMap contributors"
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
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-center text-sm text-[var(--color-text-muted)]">
          Localização não configurada.
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
            Abrir no Google Maps
          </a>
        )}
      </div>

      {!coords && (
        <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            Localização não configurada para rota interna. Configure latitude e longitude no painel da barbearia.
          </p>
        </div>
      )}

      <DirectionsMapModal
        open={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        shopId={shop.id}
        shopName={shop.name}
        shopAddress={readableAddress}
        shopFormattedAddress={shop.formatted_address}
        shopCoords={coords}
      />
    </section>
  )
}

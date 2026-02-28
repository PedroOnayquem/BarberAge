import { useMemo, useState } from 'react'
import { ExternalLink, Navigation } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { buildReadableAddress } from '../../../lib/location'
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

function parseCoordinate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ShopLocationMap({ shop }: ShopLocationMapProps) {
  const [directionsOpen, setDirectionsOpen] = useState(false)

  const coords = useMemo(() => {
    const lat = parseCoordinate(shop.latitude)
    const lng = parseCoordinate(shop.longitude)
    return lat !== null && lng !== null ? { lat, lng } : null
  }, [shop.latitude, shop.longitude])

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
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <MapContainer
            key={`inline-map-${shop.id}`}
            center={[coords!.lat, coords!.lng]}
            zoom={16}
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
            className="shop-location-inline-map h-56 w-full sm:h-64"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[coords!.lat, coords!.lng]} icon={markerIcon}>
              <Popup>{shop.name}</Popup>
            </Marker>
          </MapContainer>
        </div>
      ) : coords ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-center text-sm text-[var(--color-text-muted)]">
          Mapa expandido aberto.
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
          disabled={!coords}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
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
            Localização ainda não configurada para traçar rota. Configure a localização no painel da barbearia.
          </p>
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

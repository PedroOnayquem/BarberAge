import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { buildAddressLine, formatCep, normalizeAndRepairCoordinates, normalizeCep } from '../../../lib/location'
import { supabase } from '../../../lib/supabase'
import { Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { Select } from '../../ui/Select'
import { BRAZIL_STATES, type WizardData, type WizardErrors } from './useWizardState'
import 'leaflet/dist/leaflet.css'

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

type SetWizardField = <K extends keyof WizardData>(field: K, value: WizardData[K]) => void

interface Step2LocationProps {
  data: WizardData
  errors: WizardErrors
  onFieldChange: SetWizardField
}

type LatLngTuple = [number, number]

const DEFAULT_MAP_CENTER: LatLngTuple = [-14.235, -51.9253]
const GEOCODE_TIMEOUT_MS = 12000
const MAP_PRIMARY_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const MAP_FALLBACK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

const wizardLocationPinIcon = divIcon({
  className: 'wizard-location-marker',
  html: '<span class="wizard-location-marker-dot"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
})

interface GeocodePayload {
  cep: string
  city: string
  state: string
  neighborhood: string
  address_street: string
  address_number: string
  address: string
  complement: string | null
  persist: boolean
}

function MapRuntimeEffects({ center }: { center: LatLngTuple }) {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize()
    map.setView(center, Math.max(map.getZoom(), 16), { animate: false })
    const frame = window.requestAnimationFrame(() => map.invalidateSize())
    const settleTimer = window.setTimeout(() => map.invalidateSize(), 180)
    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(settleTimer)
      window.removeEventListener('resize', handleResize)
    }
  }, [map, center])

  return null
}

function MapClickUpdater({ onPick }: { onPick: (coords: LatLngTuple) => void }) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng])
    },
  })

  return null
}

export function Step2Location({ data, errors, onFieldChange }: Step2LocationProps) {
  const latestLookupCepRef = useRef<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepNotice, setCepNotice] = useState('')
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState('')
  const [mapRenderKey, setMapRenderKey] = useState(0)
  const [tileUrl, setTileUrl] = useState(MAP_PRIMARY_TILE_URL)
  const [pickerPosition, setPickerPosition] = useState<LatLngTuple | null>(null)
  const normalizedCep = normalizeCep(data.cep)
  const mapConfirmed = data.mapConfirmed && data.latitude !== null && data.longitude !== null

  function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message.trim()) return error.message
    return fallback
  }

  function buildGeocodePayload(): GeocodePayload {
    return {
      cep: normalizedCep,
      city: data.city.trim(),
      state: data.state.trim().toUpperCase(),
      neighborhood: data.neighborhood.trim(),
      address_street: data.street.trim(),
      address_number: data.number.trim(),
      address: buildAddressLine({
        address_street: data.street.trim(),
        address_number: data.number.trim(),
        neighborhood: data.neighborhood.trim(),
      }),
      complement: data.complement.trim() || null,
      persist: false,
    }
  }

  async function geocodeViaLocalApi(payload: GeocodePayload): Promise<LatLngTuple> {
    const params = new URLSearchParams({
      cep: payload.cep,
      city: payload.city,
      state: payload.state,
      neighborhood: payload.neighborhood,
      street: payload.address_street,
      number: payload.address_number,
      address: payload.address,
    })

    const abortController = new AbortController()
    const timeoutId = window.setTimeout(() => abortController.abort(), GEOCODE_TIMEOUT_MS)
    let response: Response

    try {
      response = await fetch(`/api/geocode?${params.toString()}`, {
        signal: abortController.signal,
      })
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error('Tempo esgotado ao buscar o mapa local.')
      }
      throw error
    } finally {
      window.clearTimeout(timeoutId)
    }

    const responseData = (await response.json().catch(() => ({}))) as Record<string, unknown>

    if (!response.ok) {
      const message =
        typeof responseData.message === 'string'
          ? responseData.message
          : 'Nao foi possivel estimar o ponto do endereco no mapa local.'
      throw new Error(message)
    }

    const coords = normalizeAndRepairCoordinates(responseData.latitude, responseData.longitude)
    if (!coords) {
      throw new Error('Geocode local retornou coordenadas invalidas.')
    }

    return [coords.latitude, coords.longitude]
  }

  async function geocodeViaSupabaseFunction(payload: GeocodePayload): Promise<LatLngTuple> {
    const response = await supabase.functions.invoke('geocode-shop-location', {
      body: payload,
    })

    if (response.error) {
      throw new Error(response.error.message || 'Falha ao consultar geocode no Supabase.')
    }

    const geocodeData = (response.data || {}) as Record<string, unknown>
    const coords = normalizeAndRepairCoordinates(geocodeData.latitude, geocodeData.longitude)
    if (!coords) {
      throw new Error('Geocode Supabase retornou coordenadas invalidas.')
    }

    return [coords.latitude, coords.longitude]
  }

  function updateAddressField<K extends keyof WizardData>(field: K, value: WizardData[K]) {
    onFieldChange(field, value)
    if (data.mapConfirmed || data.latitude !== null || data.longitude !== null) {
      onFieldChange('latitude', null)
      onFieldChange('longitude', null)
      onFieldChange('mapConfirmed', false)
    }
  }

  useEffect(() => {
    if (normalizedCep.length !== 8) {
      setCepLoading(false)
      setCepNotice('')
      latestLookupCepRef.current = null
      return
    }

    if (latestLookupCepRef.current === normalizedCep) return
    latestLookupCepRef.current = normalizedCep

    const abortController = new AbortController()

    async function lookupCep() {
      setCepLoading(true)
      setCepNotice('')

      try {
        const response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`, {
          signal: abortController.signal,
        })
        if (!response.ok) {
          throw new Error('request-failed')
        }

        const payload = (await response.json()) as ViaCepResponse
        if (payload.erro) {
          setCepNotice('CEP nao encontrado. Complete o endereco manualmente.')
          return
        }

        if (payload.logradouro?.trim()) {
          updateAddressField('street', payload.logradouro.trim())
        }
        if (payload.bairro?.trim()) {
          updateAddressField('neighborhood', payload.bairro.trim())
        }
        if (payload.localidade?.trim()) {
          updateAddressField('city', payload.localidade.trim())
        }
        if (payload.uf?.trim()) {
          updateAddressField('state', payload.uf.trim().toUpperCase().slice(0, 2))
        }
      } catch {
        if (abortController.signal.aborted) return
        setCepNotice('Nao foi possivel consultar o CEP. Continue com preenchimento manual.')
      } finally {
        if (!abortController.signal.aborted) {
          setCepLoading(false)
        }
      }
    }

    void lookupCep()

    return () => {
      abortController.abort()
    }
  }, [normalizedCep])

  async function estimateCoordinates(): Promise<LatLngTuple> {
    const payload = buildGeocodePayload()
    const collectedErrors: string[] = []

    if (import.meta.env.DEV) {
      try {
        return await geocodeViaLocalApi(payload)
      } catch (error) {
        const message = getErrorMessage(error, 'Nao foi possivel estimar o ponto do endereco no ambiente local.')
        throw new Error(message)
      }
    }

    try {
      return await geocodeViaSupabaseFunction(payload)
    } catch (error) {
      collectedErrors.push(getErrorMessage(error, 'Falha ao consultar geocode no Supabase.'))
    }

    try {
      return await geocodeViaLocalApi(payload)
    } catch (error) {
      collectedErrors.push(getErrorMessage(error, 'Falha no geocode local.'))
    }

    throw new Error(
      collectedErrors.find((entry) => entry.trim()) ||
      'Nao foi possivel estimar o ponto do endereco. Ajuste manualmente no mapa.'
    )
  }

  async function handleOpenMap() {
    setMapError('')
    setTileUrl(MAP_PRIMARY_TILE_URL)
    setMapRenderKey((current) => current + 1)
    setMapModalOpen(true)

    if (data.latitude !== null && data.longitude !== null) {
      setPickerPosition([data.latitude, data.longitude])
      return
    }

    if (!pickerPosition) {
      setPickerPosition(DEFAULT_MAP_CENTER)
    }

    if (
      normalizedCep.length !== 8 ||
      !data.street.trim() ||
      !data.number.trim() ||
      !data.city.trim() ||
      data.state.trim().toUpperCase().length !== 2
    ) {
      setMapError('Preencha CEP, rua, numero, cidade e UF para melhorar a precisao no mapa.')
      return
    }

    setMapLoading(true)
    try {
      const coords = await estimateCoordinates()
      setPickerPosition(coords)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel abrir o mapa.'
      setPickerPosition(DEFAULT_MAP_CENTER)
      setMapError(message)
    } finally {
      setMapLoading(false)
    }
  }

  function handleConfirmMap() {
    if (!pickerPosition) {
      setMapError('Defina um ponto no mapa para confirmar.')
      return
    }

    const latitude = Number(pickerPosition[0].toFixed(6))
    const longitude = Number(pickerPosition[1].toFixed(6))
    onFieldChange('latitude', latitude)
    onFieldChange('longitude', longitude)
    onFieldChange('mapConfirmed', true)
    setMapError('')
    setMapModalOpen(false)
  }

  const mapCenter = pickerPosition || DEFAULT_MAP_CENTER
  const mapStatusError = errors.mapConfirmed || mapError

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          label="CEP"
          value={data.cep}
          onChange={(event) => updateAddressField('cep', formatCep(event.target.value))}
          helperText={cepLoading ? 'Buscando CEP...' : 'Formato 00000-000'}
          error={errors.cep}
          inputMode="numeric"
          maxLength={9}
          autoComplete="postal-code"
        />
        <Select
          label="Estado (UF)"
          value={data.state}
          onChange={(event) => updateAddressField('state', event.target.value.toUpperCase())}
          error={errors.state}
        >
          {BRAZIL_STATES.map((stateOption) => (
            <option key={stateOption} value={stateOption}>
              {stateOption}
            </option>
          ))}
        </Select>
      </div>

      {cepNotice && (
        <p className="rounded-xl border border-[rgba(148,163,184,0.28)] bg-[rgba(30,41,59,0.72)] px-3 py-2 text-xs text-[#cbd5e1]">
          {cepNotice}
        </p>
      )}

      <Input
        label="Cidade"
        value={data.city}
        onChange={(event) => updateAddressField('city', event.target.value)}
        error={errors.city}
        autoComplete="address-level2"
      />

      <Input
        label="Bairro"
        value={data.neighborhood}
        onChange={(event) => updateAddressField('neighborhood', event.target.value)}
        error={errors.neighborhood}
        autoComplete="address-level3"
      />

      <Input
        label="Rua / Logradouro"
        value={data.street}
        onChange={(event) => updateAddressField('street', event.target.value)}
        error={errors.street}
        autoComplete="address-line1"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          label="Numero"
          value={data.number}
          onChange={(event) => updateAddressField('number', event.target.value)}
          error={errors.number}
          autoComplete="off"
        />
        <Input
          label="Complemento (opcional)"
          value={data.complement}
          onChange={(event) => updateAddressField('complement', event.target.value)}
          autoComplete="address-line2"
        />
      </div>

      <section className="rounded-2xl border border-[rgba(148,163,184,0.26)] bg-[rgba(15,23,42,0.72)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#f8fafc]">Confirmacao no mapa</p>
            <p className="text-xs text-[#94a3b8]">Arraste o pin para ajustar e confirme a localizacao.</p>
          </div>
          <button
            type="button"
            onClick={handleOpenMap}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mapConfirmed
                ? 'border border-[rgba(74,222,128,0.45)] bg-[rgba(22,101,52,0.35)] text-[#dcfce7]'
                : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
            }`}
          >
            <MapPin size={16} />
            {mapConfirmed ? 'Localizacao confirmada' : 'Ver no mapa / Confirmar no mapa'}
          </button>
        </div>

        {(data.latitude !== null || data.longitude !== null) && (
          <div className="mt-3 rounded-xl border border-[rgba(148,163,184,0.22)] bg-[rgba(2,6,23,0.66)] px-3 py-2 text-xs text-[#cbd5e1]">
            Latitude: {data.latitude?.toFixed(6) || '--'} | Longitude: {data.longitude?.toFixed(6) || '--'}
          </div>
        )}

        {mapStatusError && (
          <p className="mt-3 rounded-xl border border-[rgba(248,113,113,0.36)] bg-[rgba(127,29,29,0.3)] px-3 py-2 text-xs text-[#fecaca]">
            {mapStatusError}
          </p>
        )}
      </section>

      <Modal open={mapModalOpen} onClose={() => setMapModalOpen(false)} title="Confirmar localizacao da empresa" size="lg">
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">Arraste o pin para ajustar a localizacao com precisao.</p>

          <div className="wizard-map-shell relative overflow-hidden rounded-xl border border-[var(--color-border)]">
            <MapContainer
              key={`wizard-map-modal-${mapRenderKey}`}
              center={mapCenter}
              zoom={16}
              scrollWheelZoom
              className="wizard-map-root w-full"
              style={{ height: '360px', width: '100%' }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url={tileUrl}
                eventHandlers={{
                  tileerror() {
                    setTileUrl((current) => (
                      current === MAP_PRIMARY_TILE_URL ? MAP_FALLBACK_TILE_URL : current
                    ))
                  },
                }}
              />
              <Marker
                position={mapCenter}
                draggable
                icon={wizardLocationPinIcon}
                eventHandlers={{
                  dragend(event) {
                    const marker = event.target
                    const point = marker.getLatLng()
                    setPickerPosition([point.lat, point.lng])
                  },
                }}
              />
              <MapClickUpdater onPick={setPickerPosition} />
              <MapRuntimeEffects center={mapCenter} />
            </MapContainer>

            {mapLoading && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(2,6,23,0.42)] text-sm font-medium text-[#e2e8f0]">
                Buscando o endereco no mapa...
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            Toque no mapa para mover o pin rapido ou arraste para ajuste fino.
          </div>

          {mapError && (
            <p className="rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.3)] px-3 py-2 text-xs text-[#fecaca]">
              {mapError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMapModalOpen(false)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-muted)]"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleConfirmMap}
              className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
            >
              Confirmar localizacao
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

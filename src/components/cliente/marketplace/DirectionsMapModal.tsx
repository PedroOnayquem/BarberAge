import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Layers3, LocateFixed, Navigation, X } from 'lucide-react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { divIcon, latLngBounds, type Map as LeafletMap } from 'leaflet'
import { getInAppBrowserDetection } from '../../../lib/inAppBrowser'
import 'leaflet/dist/leaflet.css'

type LatLngTuple = [number, number]
type PermissionState = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported' | 'insecure'

interface LatLngObject {
  lat: number
  lng: number
}

interface DirectionsMapModalProps {
  open: boolean
  onClose: () => void
  shopName: string
  shopAddress: string
  shopCoords: LatLngObject | null
}

interface GeolocationErrorDetails {
  code: number | null
  message: string
}

const ROUTE_RECALC_DISTANCE_METERS = 30
const FOLLOW_FLY_INTERVAL_MS = 1200
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 0,
}

const GEO_ERROR_CODE_PERMISSION_DENIED = 1
const GEO_ERROR_CODE_POSITION_UNAVAILABLE = 2
const GEO_ERROR_CODE_TIMEOUT = 3

const shopMarkerIcon = divIcon({
  className: 'shop-location-marker',
  html: '<span class="shop-location-marker-dot"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
})

function buildUserArrowIcon(bearing: number) {
  return divIcon({
    className: 'user-location-arrow-marker',
    html: `<span class="user-location-arrow" style="transform: rotate(${bearing.toFixed(1)}deg)"></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI
}

function calculateDistanceMeters(from: LatLngObject, to: LatLngObject) {
  const earthRadius = 6371000
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

function calculateBearing(from: LatLngObject, to: LatLngObject) {
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)
  const dLng = toRadians(to.lng - from.lng)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  const bearing = toDegrees(Math.atan2(y, x))
  return (bearing + 360) % 360
}

function formatDistance(distanceMeters: number | null) {
  if (distanceMeters === null) return '--'
  const km = distanceMeters / 1000
  return `${km.toFixed(1)} km`
}

function formatDuration(durationSeconds: number | null) {
  if (durationSeconds === null) return '--'
  const minutes = Math.max(1, Math.round(durationSeconds / 60))
  return `${minutes} min`
}

function openExternal(url: string) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function isSecureGeolocationContext() {
  if (typeof window === 'undefined') return true
  if (window.isSecureContext) return true
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function getLocationErrorMessage(errorCode: number | null) {
  if (errorCode === GEO_ERROR_CODE_PERMISSION_DENIED) {
    return 'Permissao negada. Ative a localizacao nas configuracoes do navegador para continuar.'
  }
  if (errorCode === GEO_ERROR_CODE_POSITION_UNAVAILABLE) {
    return 'GPS indisponivel no momento. Verifique sinal/localizacao do aparelho e tente novamente.'
  }
  if (errorCode === GEO_ERROR_CODE_TIMEOUT) {
    return 'Tempo esgotado ao buscar localizacao. Tente novamente.'
  }
  return 'Nao foi possivel obter sua localizacao agora.'
}

function formatTimestamp(value: number | null) {
  if (!value) return '--'
  return new Date(value).toLocaleTimeString()
}

function MapRuntimeEffects({
  points,
  autoFit,
  onMapReady,
  onMapInteraction,
}: {
  points: LatLngTuple[]
  autoFit: boolean
  onMapReady: (map: LeafletMap) => void
  onMapInteraction: () => void
}) {
  const map = useMap()

  useEffect(() => {
    onMapReady(map)
    map.invalidateSize()
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 150)
    const handleDragStart = () => onMapInteraction()
    map.on('dragstart', handleDragStart)

    return () => {
      window.clearTimeout(resizeTimer)
      map.off('dragstart', handleDragStart)
    }
  }, [map, onMapReady, onMapInteraction])

  useEffect(() => {
    if (!autoFit || points.length === 0) return

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 16), { animate: true })
      return
    }

    map.fitBounds(latLngBounds(points), {
      padding: [40, 40],
      animate: true,
    })
  }, [map, points, autoFit])

  return null
}

export function DirectionsMapModal({
  open,
  onClose,
  shopName,
  shopAddress,
  shopCoords,
}: DirectionsMapModalProps) {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking')
  const [userCoords, setUserCoords] = useState<LatLngObject | null>(null)
  const [routeOriginCoords, setRouteOriginCoords] = useState<LatLngObject | null>(null)
  const [userBearing, setUserBearing] = useState(0)
  const [permissionMessage, setPermissionMessage] = useState('')
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([])
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [locationError, setLocationError] = useState<GeolocationErrorDetails | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapRenderKey, setMapRenderKey] = useState(0)
  const [tileVariant, setTileVariant] = useState<'osm' | 'carto'>('osm')
  const [isFollowingUser, setIsFollowingUser] = useState(true)
  const [mapWasMoved, setMapWasMoved] = useState(false)
  const [devSimulationEnabled, setDevSimulationEnabled] = useState(false)
  const [permissionApiState, setPermissionApiState] = useState<'available' | 'unavailable'>('unavailable')
  const [lastRequestAt, setLastRequestAt] = useState<number | null>(null)

  const mapRef = useRef<LeafletMap | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const permissionStatusRef = useRef<PermissionStatus | null>(null)
  const openSessionRef = useRef(0)
  const prevGpsRef = useRef<LatLngObject | null>(null)
  const lastRouteOriginRef = useRef<LatLngObject | null>(null)
  const lastFlyAtRef = useRef(0)
  const followUserRef = useRef(true)
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const inAppDetection = useMemo(() => getInAppBrowserDetection(userAgent), [userAgent])
  const isInAppBrowser = inAppDetection.isInAppBrowser

  function logGeoEvent(event: string, payload?: Record<string, unknown>) {
    if (!import.meta.env.DEV) return
    console.info(`[directions][geolocation] ${event}`, payload || {})
  }

  function handleLocationFailure(error: GeolocationPositionError, source: 'getCurrentPosition' | 'watchPosition') {
    const errorCode = typeof error.code === 'number' ? error.code : null
    const errorMessage = error.message || ''
    const friendlyMessage = getLocationErrorMessage(errorCode)

    setLocationError({ code: errorCode, message: errorMessage })
    setLoadingLocation(false)
    setPermissionMessage(friendlyMessage)

    if (errorCode === GEO_ERROR_CODE_PERMISSION_DENIED) {
      setPermissionState('denied')
      if (source === 'watchPosition') {
        clearLocationWatch()
      }
    } else {
      setPermissionState('prompt')
    }

    logGeoEvent('error', {
      source,
      code: errorCode,
      message: errorMessage,
      protocol: window.location.protocol,
      origin: window.location.origin,
      secureContext: isSecureGeolocationContext(),
    })
  }

  useEffect(() => {
    followUserRef.current = isFollowingUser
  }, [isFollowingUser])

  function clearLocationWatch() {
    if (watchIdRef.current === null || !navigator.geolocation) return
    navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
  }

  function clearPermissionListener() {
    if (permissionStatusRef.current) {
      permissionStatusRef.current.onchange = null
      permissionStatusRef.current = null
    }
  }

  function updateUserFromPosition(coords: GeolocationCoordinates) {
    const nextCoords = {
      lat: coords.latitude,
      lng: coords.longitude,
    }

    const previousCoords = prevGpsRef.current
    const movementFromPrevious = previousCoords ? calculateDistanceMeters(previousCoords, nextCoords) : 0
    const hasHeading =
      typeof coords.heading === 'number' && Number.isFinite(coords.heading) && coords.heading >= 0

    setLoadingLocation(false)
    setPermissionMessage('')
    setLocationError(null)
    setUserCoords(nextCoords)

    if (hasHeading) {
      setUserBearing(coords.heading as number)
    } else if (previousCoords && movementFromPrevious >= 1) {
      setUserBearing(calculateBearing(previousCoords, nextCoords))
    }

    prevGpsRef.current = nextCoords

    if (!lastRouteOriginRef.current) {
      lastRouteOriginRef.current = nextCoords
      setRouteOriginCoords(nextCoords)
    } else {
      const movedSinceRouteOrigin = calculateDistanceMeters(lastRouteOriginRef.current, nextCoords)
      if (movedSinceRouteOrigin >= ROUTE_RECALC_DISTANCE_METERS) {
        lastRouteOriginRef.current = nextCoords
        setRouteOriginCoords(nextCoords)
      }
    }

    if (followUserRef.current && mapRef.current) {
      const now = Date.now()
      if (now - lastFlyAtRef.current >= FOLLOW_FLY_INTERVAL_MS) {
        mapRef.current.flyTo([nextCoords.lat, nextCoords.lng], Math.max(mapRef.current.getZoom(), 16), {
          animate: true,
          duration: 0.65,
        })
        lastFlyAtRef.current = now
      }
    }
  }

  function startWatchPosition(openSession: number) {
    if (!navigator.geolocation) return

    clearLocationWatch()

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (openSessionRef.current !== openSession) return
        updateUserFromPosition(position.coords)
      },
      (error) => {
        if (openSessionRef.current !== openSession) return
        handleLocationFailure(error, 'watchPosition')
      },
      GEO_OPTIONS
    )

    watchIdRef.current = watchId
  }

  async function syncPermissionState(options?: { source?: string }) {
    if (!navigator.permissions?.query) {
      setPermissionApiState('unavailable')
      setPermissionState('unsupported')
      logGeoEvent('permission-api-unavailable', { source: options?.source || 'unknown' })
      return 'unsupported' as PermissionState
    }

    setPermissionApiState('available')
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' })
      permissionStatusRef.current = permissionStatus
      const nextState = permissionStatus.state as PermissionState
      setPermissionState(nextState)

      permissionStatus.onchange = () => {
        const currentState = permissionStatus.state as PermissionState
        setPermissionState(currentState)
        logGeoEvent('permission-state-changed', { state: currentState })
      }

      logGeoEvent('permission-state', {
        source: options?.source || 'unknown',
        state: nextState,
      })
      return nextState
    } catch (error) {
      setPermissionApiState('unavailable')
      setPermissionState('unsupported')
      logGeoEvent('permission-query-failed', {
        source: options?.source || 'unknown',
        error: String(error || ''),
      })
      return 'unsupported' as PermissionState
    }
  }

  async function handleRequestLocation() {
    if (!open || !shopCoords) return

    const requestTimestamp = Date.now()
    setLastRequestAt(requestTimestamp)
    logGeoEvent('request-location-click', {
      at: requestTimestamp,
      protocol: window.location.protocol,
      origin: window.location.origin,
      secureContext: isSecureGeolocationContext(),
      isInAppBrowser,
      inAppSource: inAppDetection.source || '',
    })

    if (!isSecureGeolocationContext()) {
      setPermissionState('insecure')
      setPermissionMessage('Geolocalizacao exige HTTPS no celular. Abra o app em https:// para permitir localizacao.')
      setLocationError({ code: null, message: 'Insecure context (HTTP)' })
      setLoadingLocation(false)
      return
    }

    const permissionBeforeRequest = await syncPermissionState({ source: 'request-click' })
    if (permissionBeforeRequest === 'denied') {
      setPermissionState('denied')
      setPermissionMessage('Permissao negada no navegador. Habilite a localizacao e toque em "Recarregar apos habilitar".')
      setLocationError({ code: GEO_ERROR_CODE_PERMISSION_DENIED, message: 'Permission state denied before request' })
      setLoadingLocation(false)
      return
    }

    if (!navigator.geolocation) {
      setPermissionState('denied')
      setPermissionMessage('Geolocalizacao nao suportada neste navegador.')
      setLocationError({ code: null, message: 'Geolocation API not supported' })
      return
    }

    const openSession = openSessionRef.current
    setLoadingLocation(true)
    setPermissionMessage('')
    setRouteError('')
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (openSessionRef.current !== openSession) return
        setPermissionState('granted')
        updateUserFromPosition(position.coords)
        startWatchPosition(openSession)
      },
      (error) => {
        if (openSessionRef.current !== openSession) return
        handleLocationFailure(error, 'getCurrentPosition')
      },
      GEO_OPTIONS
    )
  }

  async function handleRefreshPermission() {
    const nextState = await syncPermissionState({ source: 'manual-refresh' })
    if (nextState === 'granted') {
      setPermissionMessage('Permissao habilitada. Toque em "Tentar novamente" para buscar sua localizacao.')
      setLocationError(null)
    }
  }

  function handleOpenInBrowser() {
    const currentUrl = window.location.href
    window.open(currentUrl, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    if (!open) {
      clearLocationWatch()
      clearPermissionListener()
      return
    }

    setMapRenderKey((previous) => previous + 1)

    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    openSessionRef.current += 1
    prevGpsRef.current = null
    lastRouteOriginRef.current = null
    lastFlyAtRef.current = 0
    setMapReady(false)
    setPermissionState('checking')
    setUserCoords(null)
    setRouteOriginCoords(null)
    setUserBearing(0)
    setPermissionMessage('')
    setRoutePoints([])
    setDistanceMeters(null)
    setDurationSeconds(null)
    setRouteError('')
    setLocationError(null)
    setLastRequestAt(null)
    setMapWasMoved(false)
    setIsFollowingUser(true)
    setDevSimulationEnabled(false)
    logGeoEvent('modal-open', {
      origin: window.location.origin,
      protocol: window.location.protocol,
      secureContext: isSecureGeolocationContext(),
      isInAppBrowser,
      inAppSource: inAppDetection.source || '',
      shopHasCoords: Boolean(shopCoords),
    })

    if (!shopCoords) {
      setPermissionState('denied')
      setPermissionMessage('Localizacao ainda nao configurada para esta barbearia.')
    } else if (!isSecureGeolocationContext()) {
      setPermissionState('insecure')
      setPermissionMessage('Geolocalizacao exige HTTPS no celular. Abra o app em https:// para permitir localizacao.')
      setLocationError({ code: null, message: 'Insecure context (HTTP)' })
    } else {
      void syncPermissionState({ source: 'modal-open' })
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
      clearLocationWatch()
      clearPermissionListener()
    }
  }, [open, shopCoords?.lat, shopCoords?.lng, isInAppBrowser, inAppDetection.source])

  useEffect(() => {
    if (!open || !shopCoords || !routeOriginCoords) return
    if (import.meta.env.DEV && devSimulationEnabled) return

    const openSession = openSessionRef.current
    const controller = new AbortController()
    const origin = routeOriginCoords
    const destination = shopCoords

    async function fetchRoute() {
      setLoadingRoute(true)
      setRouteError('')

      const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`

      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error('Falha ao buscar rota no OSRM.')
        }

        const payload = (await response.json()) as {
          code?: string
          routes?: Array<{
            distance?: number
            duration?: number
            geometry?: { coordinates?: [number, number][] }
          }>
        }

        if (openSessionRef.current !== openSession || controller.signal.aborted) return

        if (payload.code !== 'Ok' || !payload.routes?.length) {
          throw new Error('Nenhuma rota encontrada.')
        }

        const route = payload.routes[0]
        const coordinates = route.geometry?.coordinates || []
        const parsedPoints = coordinates.map((item) => [item[1], item[0]] as LatLngTuple)

        setRoutePoints(parsedPoints)
        setDistanceMeters(typeof route.distance === 'number' ? route.distance : null)
        setDurationSeconds(typeof route.duration === 'number' ? route.duration : null)
      } catch {
        if (controller.signal.aborted || openSessionRef.current !== openSession) return
        setRouteError('Nao foi possivel calcular a rota agora.')
      } finally {
        if (!controller.signal.aborted && openSessionRef.current === openSession) {
          setLoadingRoute(false)
        }
      }
    }

    void fetchRoute()
    return () => controller.abort()
  }, [
    open,
    shopCoords?.lat,
    shopCoords?.lng,
    routeOriginCoords?.lat,
    routeOriginCoords?.lng,
    devSimulationEnabled,
  ])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (!open || !devSimulationEnabled || routePoints.length < 2) return

    setPermissionMessage('Modo simulacao ativo (dev).')

    let stepIndex = 0
    const maxIndex = routePoints.length - 1

    const firstPoint = routePoints[0]
    const firstCoords = { lat: firstPoint[0], lng: firstPoint[1] }
    setUserCoords(firstCoords)
    prevGpsRef.current = firstCoords

    const timer = window.setInterval(() => {
      const from = routePoints[stepIndex]
      const to = routePoints[Math.min(stepIndex + 1, maxIndex)]
      const nextCoords = { lat: to[0], lng: to[1] }

      setUserCoords(nextCoords)
      setUserBearing(calculateBearing({ lat: from[0], lng: from[1] }, nextCoords))
      prevGpsRef.current = nextCoords
      setRouteOriginCoords(nextCoords)

      if (followUserRef.current && mapRef.current) {
        mapRef.current.flyTo([nextCoords.lat, nextCoords.lng], Math.max(mapRef.current.getZoom(), 16), {
          animate: true,
          duration: 0.6,
        })
      }

      stepIndex = stepIndex >= maxIndex - 1 ? 0 : stepIndex + 1
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [open, devSimulationEnabled, routePoints])

  const mapCenter = useMemo<LatLngTuple | null>(() => {
    if (!shopCoords) return null
    return [shopCoords.lat, shopCoords.lng]
  }, [shopCoords])

  const googleMapsUrl = useMemo(() => {
    if (shopCoords && userCoords) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${shopCoords.lat},${shopCoords.lng}&travelmode=driving`
    }
    if (shopCoords) {
      return `https://www.google.com/maps/dir/?api=1&destination=${shopCoords.lat},${shopCoords.lng}&travelmode=driving`
    }
    const query = encodeURIComponent(shopAddress)
    return `https://www.google.com/maps/search/?api=1&query=${query}`
  }, [shopAddress, shopCoords, userCoords])

  const wazeUrl = useMemo(() => {
    if (!shopCoords) return ''
    return `https://waze.com/ul?ll=${shopCoords.lat},${shopCoords.lng}&navigate=yes`
  }, [shopCoords])

  const boundsPoints = useMemo<LatLngTuple[]>(() => {
    if (routePoints.length > 0) return routePoints
    const points: LatLngTuple[] = []
    if (shopCoords) points.push([shopCoords.lat, shopCoords.lng])
    if (userCoords) points.push([userCoords.lat, userCoords.lng])
    return points
  }, [routePoints, shopCoords, userCoords])

  const userArrowIcon = useMemo(() => buildUserArrowIcon(userBearing), [userBearing])

  const tileConfig = useMemo(() => {
    if (tileVariant === 'carto') {
      return {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        label: 'Layer: Clean',
      }
    }
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      label: 'Layer: OSM',
    }
  }, [tileVariant])

  function handleRecenter() {
    const map = mapRef.current
    if (!map) return

    setIsFollowingUser(true)
    setMapWasMoved(false)

    if (routePoints.length > 1) {
      map.fitBounds(latLngBounds(routePoints), { padding: [40, 40], animate: true })
      return
    }

    if (userCoords) {
      map.setView([userCoords.lat, userCoords.lng], Math.max(map.getZoom(), 16), { animate: true })
      return
    }

    if (shopCoords) {
      map.setView([shopCoords.lat, shopCoords.lng], Math.max(map.getZoom(), 16), { animate: true })
    }
  }

  function handleMapInteraction() {
    setMapWasMoved(true)
    setIsFollowingUser(false)
  }

  if (!open || typeof document === 'undefined') return null

  const modalStyle: CSSProperties = {
    background:
      'radial-gradient(120% 120% at 50% 0%, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 23, 1) 70%)',
  }

  const showPermissionPrompt =
    !userCoords && !loadingLocation && (permissionState === 'prompt' || permissionState === 'unsupported')
  const showDeniedFallback = !userCoords && !loadingLocation && permissionState === 'denied'
  const showInsecureContext = !userCoords && !loadingLocation && permissionState === 'insecure'
  const showPermissionChecking = !userCoords && permissionState === 'checking'
  const locationStatusMessage =
    permissionMessage || (!userCoords && loadingLocation ? 'Localizando...' : '')
  const showInAppWarning = !userCoords && isInAppBrowser
  const debugInfo = useMemo(() => {
    if (!import.meta.env.DEV) return ''
    return [
      `ua=${userAgent}`,
      `inApp=${isInAppBrowser ? 'yes' : 'no'}${inAppDetection.source ? `(${inAppDetection.source})` : ''}`,
      `permission=${permissionState}`,
      `permissionsApi=${permissionApiState}`,
      `secureContext=${window.isSecureContext ? 'yes' : 'no'}`,
      `protocol=${window.location.protocol}`,
      `origin=${window.location.origin}`,
      `lastClick=${formatTimestamp(lastRequestAt)}`,
      `errorCode=${locationError?.code ?? '-'}`,
      `errorMessage=${locationError?.message || '-'}`,
    ].join(' | ')
  }, [
    inAppDetection.source,
    isInAppBrowser,
    lastRequestAt,
    locationError?.code,
    locationError?.message,
    permissionApiState,
    permissionState,
    userAgent,
  ])

  return createPortal(
    <div className="directions-map-modal fixed inset-0 z-[160]" style={modalStyle}>
      <div className="absolute inset-0 flex min-h-0 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[6] flex items-center justify-between gap-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            onClick={onClose}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-white shadow-[0_6px_22px_rgba(2,6,23,0.45)] backdrop-blur transition-colors hover:bg-slate-800/90"
            aria-label="Fechar direcoes"
          >
            <X size={18} />
          </button>

          <div className="pointer-events-auto rounded-full border border-white/20 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-slate-100 backdrop-blur">
            {shopName}
          </div>

          <button
            onClick={() => setTileVariant((value) => (value === 'osm' ? 'carto' : 'osm'))}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-white shadow-[0_6px_22px_rgba(2,6,23,0.45)] backdrop-blur transition-colors hover:bg-slate-800/90"
            aria-label="Alternar camada"
            title={tileConfig.label}
          >
            <Layers3 size={17} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {mapCenter ? (
            <>
              <MapContainer
                key={`directions-map-${mapRenderKey}`}
                center={mapCenter}
                zoom={15}
                scrollWheelZoom
                zoomControl={false}
                attributionControl={false}
                className="h-full w-full"
                whenReady={() => setMapReady(true)}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url={tileConfig.url}
                />
                <Marker position={[shopCoords!.lat, shopCoords!.lng]} icon={shopMarkerIcon} />
                {userCoords && <Marker position={[userCoords.lat, userCoords.lng]} icon={userArrowIcon} />}

                {routePoints.length > 1 && (
                  <Polyline
                    positions={routePoints}
                    pathOptions={{
                      color: '#2563eb',
                      weight: 6,
                      opacity: 0.95,
                    }}
                  />
                )}

                <MapRuntimeEffects
                  points={boundsPoints}
                  autoFit={isFollowingUser}
                  onMapReady={(map) => {
                    mapRef.current = map
                  }}
                  onMapInteraction={handleMapInteraction}
                />
              </MapContainer>

              {!mapReady && (
                <div className="pointer-events-none absolute inset-0 animate-pulse bg-slate-900/55" />
              )}

              {(loadingLocation || loadingRoute) && (
                <div className="absolute inset-0 z-[4] flex items-center justify-center bg-slate-900/35 backdrop-blur-[1px]">
                  <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-slate-900/85 px-4 py-3 text-sm font-medium text-slate-100 shadow-[0_8px_28px_rgba(2,6,23,0.4)] backdrop-blur">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                    Localizando...
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 top-[max(3.9rem,calc(env(safe-area-inset-top)+3.2rem))] z-[5] flex items-center justify-center px-4">
                <div className="pointer-events-auto rounded-full border border-white/20 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-[0_6px_20px_rgba(2,6,23,0.35)] backdrop-blur">
                  {formatDuration(durationSeconds)} • {formatDistance(distanceMeters)}
                </div>
              </div>

              {mapWasMoved && userCoords && (
                <button
                  onClick={handleRecenter}
                  className="absolute right-4 z-[6] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-900/82 text-slate-100 shadow-[0_8px_26px_rgba(2,6,23,0.4)] backdrop-blur transition-all hover:scale-[1.02] hover:bg-slate-800/90"
                  style={{ bottom: 'calc(clamp(252px, 36dvh, 360px) + 16px)' }}
                  aria-label="Voltar para minha posicao"
                  title="Voltar para minha posicao"
                >
                  <LocateFixed size={18} />
                </button>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-900/60 px-6 text-center text-sm text-slate-200">
              Localizacao ainda nao configurada.
            </div>
          )}
        </div>

        <div className="relative z-[6] px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto h-[clamp(252px,36dvh,360px)] max-w-3xl rounded-t-3xl border border-b-0 border-white/15 bg-slate-950/84 px-4 pb-4 pt-3 shadow-[0_-16px_38px_rgba(2,6,23,0.55)] backdrop-blur-xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/35" />

            {showPermissionChecking && (
              <div className="space-y-3">
                <p className="text-sm text-slate-200">Verificando permissao de localizacao...</p>
                <div className="h-2 w-full animate-pulse rounded-full bg-white/20" />
              </div>
            )}

            {showPermissionPrompt && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-50">Permitir localizacao para rotas</h3>
                <p className="text-sm text-slate-300">
                  Precisamos da sua localizacao para tracar o caminho ate a barbearia.
                </p>
                {permissionMessage && <p className="text-xs text-slate-300">{permissionMessage}</p>}
                {showInAppWarning && (
                  <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                    Navegador embutido detectado ({inAppDetection.source || 'in-app'}). Abra no Chrome/Safari para usar localizacao.
                  </div>
                )}
                {import.meta.env.DEV && !!debugInfo && <p className="text-[11px] text-slate-400">{debugInfo}</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={handleRequestLocation}
                    className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
                  >
                    Permitir localizacao
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
                {showInAppWarning && (
                  <button
                    onClick={handleOpenInBrowser}
                    className="w-full rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/20"
                  >
                    Abrir no navegador
                  </button>
                )}
              </div>
            )}

            {showInsecureContext && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-50">Localizacao indisponivel neste link</h3>
                <p className="text-sm text-slate-300">
                  No celular, a geolocalizacao precisa de HTTPS. Abra o app em uma URL segura para permitir rota em tempo real.
                </p>
                {permissionMessage && <p className="text-xs text-slate-300">{permissionMessage}</p>}
                {import.meta.env.DEV && !!debugInfo && <p className="text-[11px] text-slate-400">{debugInfo}</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => openExternal(googleMapsUrl)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
                  >
                    <Navigation size={16} />
                    Abrir no Google Maps
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                  >
                    Fechar
                  </button>
                </div>
                {showInAppWarning && (
                  <button
                    onClick={handleOpenInBrowser}
                    className="w-full rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/20"
                  >
                    Abrir no navegador
                  </button>
                )}
              </div>
            )}

            {showDeniedFallback && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-50">Permissao de localizacao negada</h3>
                <p className="text-sm text-slate-300">
                  Ative a localizacao para ver a rota em tempo real ate a barbearia.
                </p>
                {permissionMessage && <p className="text-xs text-slate-300">{permissionMessage}</p>}
                {showInAppWarning && (
                  <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                    Navegador embutido detectado ({inAppDetection.source || 'in-app'}). Abra no Chrome/Safari para liberar localizacao.
                  </div>
                )}
                {import.meta.env.DEV && !!debugInfo && <p className="text-[11px] text-slate-400">{debugInfo}</p>}
                {locationError && (
                  <p className="text-[11px] text-slate-400">
                    Erro {locationError.code ?? '-'}: {locationError.message || 'sem detalhe'}
                  </p>
                )}
                <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-slate-300">
                  <p>Como habilitar:</p>
                  <p>Chrome Android: cadeado do site &gt; Permissoes &gt; Localizacao &gt; Permitir.</p>
                  <p>iOS Safari: Ajustes do iPhone &gt; Safari &gt; Localizacao (ou permissao do site) &gt; Permitir.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => openExternal(googleMapsUrl)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
                  >
                    <Navigation size={16} />
                    Abrir no Google Maps
                  </button>
                  <button
                    onClick={handleRequestLocation}
                    className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                  >
                    Tentar novamente
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={handleRefreshPermission}
                    className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                  >
                    Recarregar apos habilitar
                  </button>
                  {showInAppWarning ? (
                    <button
                      onClick={handleOpenInBrowser}
                      className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/20"
                    >
                      Abrir no navegador
                    </button>
                  ) : (
                    <button
                      onClick={onClose}
                      className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                    >
                      Fechar
                    </button>
                  )}
                </div>
              </div>
            )}

            {!showPermissionChecking && !showPermissionPrompt && !showDeniedFallback && !showInsecureContext && (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">Rota</p>
                <h3 className="mt-1 text-lg font-bold text-slate-50">{shopName}</h3>
                <p className="mt-1 text-sm text-slate-300">{shopAddress}</p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-300">Distancia</p>
                    <p className="text-sm font-semibold text-slate-50">{formatDistance(distanceMeters)}</p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-300">Tempo estimado</p>
                    <p className="text-sm font-semibold text-slate-50">{formatDuration(durationSeconds)}</p>
                  </div>
                </div>

                {locationStatusMessage && (
                  <p className="mt-2 text-xs text-slate-300">{locationStatusMessage}</p>
                )}
                {routeError && (
                  <p className="mt-2 text-xs text-slate-300">{routeError}</p>
                )}
                {locationError && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Erro geolocalizacao {locationError.code ?? '-'}: {locationError.message || 'sem detalhe'}
                  </p>
                )}
                {import.meta.env.DEV && !!debugInfo && <p className="mt-2 text-[11px] text-slate-400">{debugInfo}</p>}

                {!userCoords && permissionState === 'granted' && (
                  <button
                    onClick={handleRequestLocation}
                    className="mt-3 w-full rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
                  >
                    Usar minha localizacao agora
                  </button>
                )}

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => openExternal(googleMapsUrl)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
                  >
                    <Navigation size={16} />
                    Abrir no Google Maps
                  </button>
                  <button
                    onClick={() => openExternal(wazeUrl)}
                    disabled={!wazeUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-50 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ExternalLink size={16} />
                    Abrir no Waze
                  </button>
                </div>

                {import.meta.env.DEV && (
                  <button
                    onClick={() => setDevSimulationEnabled((value) => !value)}
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-200 transition-colors hover:bg-white/10"
                  >
                    {devSimulationEnabled ? 'Parar simulacao' : 'Simular deslocamento (dev)'}
                  </button>
                )}
              </>
            )}

            <p className="mt-2 text-[11px] text-slate-400">Map data © OpenStreetMap contributors</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

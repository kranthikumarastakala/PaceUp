'use client'

import { useEffect } from 'react'
import type { GpxPoint } from '@/lib/types'

interface Props {
  points: GpxPoint[]
  height?: string
}

export function RouteMap({ points, height = '300px' }: Props) {
  useEffect(() => {
    if (typeof window === 'undefined' || points.length === 0) return

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default marker icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const mapEl = document.getElementById('route-map')
      if (!mapEl) return

      // Remove existing map instance if any
      const existingMap = (mapEl as any)._leaflet_id
      if (existingMap) return

      const latlngs = points.map((p) => [p.lat, p.lng] as [number, number])
      const map = L.map('route-map', { zoomControl: true, scrollWheelZoom: false })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const polyline = L.polyline(latlngs, {
        color: '#f97316',
        weight: 4,
        opacity: 0.9,
        lineJoin: 'round',
      }).addTo(map)

      // Start marker
      L.circleMarker(latlngs[0], { radius: 8, fillColor: '#22c55e', color: '#fff', weight: 2, fillOpacity: 1 })
        .bindPopup('Start').addTo(map)

      // End marker
      L.circleMarker(latlngs[latlngs.length - 1], { radius: 8, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 })
        .bindPopup('Finish').addTo(map)

      map.fitBounds(polyline.getBounds(), { padding: [24, 24] })
    })
  }, [points])

  if (points.length === 0) return null

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div id="route-map" style={{ height }} className="w-full rounded-xl border border-gray-100" />
    </>
  )
}



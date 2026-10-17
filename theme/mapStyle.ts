/**
 * Estilo del mapa de Google en modo oscuro.
 *
 * Google Maps no sigue el tema del sistema: sin esto, abrir el mapa de noche
 * dispara un rectángulo blanco en mitad de una interfaz oscura. Los grises
 * usan el mismo tono de marca que el resto del sistema de color.
 */
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1D1E22' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#868892' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#141518' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#5D5F66' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#BEC0C7' }] },
  { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#71737C' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1B2A22' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2E3036' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#202124' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#A0A2AB' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3D3F47' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#171C46' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#26272C' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1B2A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4550BC' }] },
];

/** En claro se usa el estilo por defecto de Google, que ya es sobrio. */
export const lightMapStyle: typeof darkMapStyle = [];

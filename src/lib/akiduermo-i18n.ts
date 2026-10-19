export type StayLocale = "en" | "es";

const spanish: Record<string, string> = {
  "No saved stays match these filters.":
    "Ningún alojamiento guardado coincide con estos filtros.",
  "AkiDuermo home": "Inicio de AkiDuermo",
  "EARLY PREVIEW": "VISTA PREVIA",
  "Go out with AkiPasa": "Sal con AkiPasa",
  "Málaga, Spain": "Málaga, España",
  "GO OUT. STAY A LITTLE LONGER.": "SAL. QUÉDATE UN POCO MÁS.",
  "A good day deserves": "Un buen día merece",
  "a great stay.": "una gran estancia.",
  "Little hideaways. City weekends. One more night.":
    "Pequeños refugios. Escapadas urbanas. Una noche más.",
  "Find your place in Spain.": "Encuentra tu lugar en España.",
  "Plan your stay": "Planifica tu estancia",
  "WHERE TO?": "¿DÓNDE?",
  Destination: "Destino",
  "City, town or property": "Ciudad, pueblo o alojamiento",
  "CHECK IN": "ENTRADA",
  "Check in": "Entrada",
  "CHECK OUT": "SALIDA",
  "Check out": "Salida",
  "WHO’S COMING?": "¿QUIÉN VIENE?",
  Guests: "Huéspedes",
  guest: "huésped",
  guests: "huéspedes",
  "Find a stay": "Buscar alojamiento",
  "A new way to stay, from the people behind AkiPasa.":
    "Una nueva forma de alojarte, de la mano de AkiPasa.",
  "Browse now · Bookings coming later": "Explora ahora · Reservas próximamente",
  "Check live availability on participating stays":
    "Consulta la disponibilidad de los alojamientos participantes",
  "Check the property for live rates":
    "Consulta la ficha para ver precios disponibles",
  "Booking requests only at participating stays. No online payments.":
    "Solicitudes de reserva solo en alojamientos participantes. Sin pagos en línea.",
  "A CHANGE OF SCENERY": "CAMBIA DE AIRES",
  "Where will you wake up?": "¿Dónde te despertarás?",
  "A few places to start": "Ideas para empezar",
  "Sea, sun & slow mornings": "Mar, sol y mañanas sin prisa",
  "Stay a little closer to magic": "Duerme un poco más cerca de la magia",
  "One more night in the city": "Una noche más en la ciudad",
  "City energy. Coastal soul.": "Energía urbana. Alma mediterránea.",
  "MAKE YOURSELF AT HOME": "SIÉNTETE COMO EN CASA",
  "Your saved stays": "Tus alojamientos guardados",
  "A place for every kind of trip": "Un lugar para cada escapada",
  "List view": "Ver lista",
  "Map view": "Ver mapa",
  "Property type": "Tipo de alojamiento",
  "All stays": "Todos",
  Hotels: "Hoteles",
  Apartments: "Apartamentos",
  "Rural escapes": "Casas rurales",
  Hostels: "Albergues",
  "Guest houses": "Hostales y pensiones",
  Camping: "Campings",
  Motels: "Moteles",
  "Student stays": "Residencias de estudiantes",
  "Finding your next stay…": "Buscando tu próximo alojamiento…",
  "Listings awaiting property verification":
    "Alojamientos pendientes de verificación",
  "Try again": "Reintentar",
  Accommodation: "Alojamiento",
  "Property photos coming soon": "Fotos del alojamiento próximamente",
  Unsave: "Dejar de guardar",
  Save: "Guardar",
  View: "Ver",
  "Discover the property": "Descubre el alojamiento",
  "Rates & availability coming later": "Precios y disponibilidad próximamente",
  "Tap the heart on a stay to keep it here.":
    "Pulsa el corazón de un alojamiento para guardarlo aquí.",
  "No stays found. Try a nearby town or another property type.":
    "No se encontraron alojamientos. Prueba con una localidad cercana u otro tipo.",
  Previous: "Anterior",
  Next: "Siguiente",
  Page: "Página",
  of: "de",
  "THE NIGHT IS ONLY HALF THE STORY":
    "LA NOCHE ES SOLO LA MITAD DE LA HISTORIA",
  "Stay here. Go everywhere.": "Quédate aquí. Descúbrelo todo.",
  "Find a place to stay, then discover the food, music and little adventures around it.":
    "Encuentra dónde dormir y descubre la gastronomía, la música y las pequeñas aventuras de alrededor.",
  "Explore AkiPasa": "Descubre AkiPasa",
  "A new chapter in the AkiPasa family.":
    "Un nuevo capítulo en la familia AkiPasa.",
  "Discovery preview. No bookings or payments are taken.":
    "Vista previa. No se realizan reservas ni pagos.",
  Privacy: "Privacidad",
  Terms: "Condiciones",
  "AkiDuermo navigation": "Navegación de AkiDuermo",
  Explore: "Descubrir",
  Saved: "Guardados",
  Map: "Mapa",
  Bookings: "Reservas",
  Account: "Cuenta",
  "Close property details": "Cerrar detalles del alojamiento",
  "This listing is unclaimed and awaits property verification. Prices, facilities and availability have not been confirmed.":
    "Este alojamiento aún no tiene un propietario verificado. Los precios, las instalaciones y la disponibilidad no se han confirmado.",
  "Visit property website": "Visitar la web del alojamiento",
  "View listing on AkiPasa": "Ver ficha en AkiPasa",
  "Remove from saved": "Quitar de guardados",
  "Save this stay": "Guardar alojamiento",
  "We couldn’t load stays just now.":
    "No se han podido cargar los alojamientos.",
  "Your browser couldn’t save this stay. Allow local storage to keep favourites.":
    "Tu navegador no ha podido guardar este alojamiento. Permite el almacenamiento local para guardar favoritos.",
  "Dates are for planning; availability is not checked yet.":
    "Las fechas son orientativas; todavía no se comprueba la disponibilidad.",
  "Find your stay in": "Encuentra alojamiento en",
  "saved on this device": "guardados en este dispositivo",
  "places to explore": "alojamientos para descubrir",
  around: "cerca de",
  "across Spain": "en toda España",
};

export function stayText(locale: StayLocale, text: string): string {
  return locale === "es" ? spanish[text] || text : text;
}

export function stayLocale(query: string | null, cookie?: string): StayLocale {
  const value = query === "es" || query === "en" ? query : cookie;
  return value === "es" ? "es" : "en";
}

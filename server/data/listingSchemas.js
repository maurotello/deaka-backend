// Este archivo define los campos extra requeridos para cada listing_type
export const listingSchemas = {
    // listing_type_id = 1 ("Negocio Local")
    '1': [],

    // listing_type_id = 2 ("Servicio Profesional")
    '2': [
        { name: 'salary_range', label: 'Rango de Precios', type: 'text', required: false },
        { name: 'service_type', label: 'Tipo de Servicio', type: 'text', required: true }
    ],

    // listing_type_id = 3 ("Evento")
    '3': [
        { name: 'event_date', label: 'Día del Evento', type: 'date', required: true },
        { name: 'event_time', label: 'Horario del Evento', type: 'time', required: false },
        { name: 'is_free', label: 'Entrada Gratuita', type: 'boolean', required: false },
        { name: 'contact', label: 'Contacto', type: 'text', required: true },
    ],

    // listing_type_id = 4 ("Punto de Interés")
    '4': [],
    // Vehículos
    '5': [
        { name: 'type', label: 'Tipo', type: 'select', options: ['Auto', 'Moto', 'Cuatricilo', 'Bicicleta', 'Camión', 'Casilla', 'Colectivo', 'otro'], required: true },
        { name: 'car_brand', label: 'Marca', type: 'select', options: ['Toyota', 'Honda', 'Chevrolet', 'BMW', 'Mercedes Benz', 'Nissan', 'Volkswagen', 'Hyundai', 'Kia', 'Tesla', 'Ford', 'Fiat', 'Renault', 'Suzuki', 'otro'], required: true },
        { name: 'model', label: 'Modelo', type: 'text', required: true },
        { name: 'anio', label: 'Año', type: 'integer', required: true },
        { name: 'kilometre', label: 'Kilómetros', type: 'text', required: true },
        { name: 'price', label: 'Precio', type: 'text', required: true },
    ]
};

// Se podría crear un endpoint simple para que el frontend pida estos esquemas:
// GET /api/listing-types/:id/schema

/*
Campos para eventos
Información de contacto


*/


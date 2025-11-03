// Este archivo define los campos extra requeridos para cada listing_type
export const listingSchemas = {
    // listing_type_id = 1 (asumimos que es "lugares" o "general")
    '4': [],
    // listing_type_id = 2 (asumimos que es "eventos")
    '1': [
        { name: 'event_date', label: 'Día del Evento', type: 'date', required: true },
        { name: 'event_time', label: 'Horario del Evento', type: 'time', required: false },
        { name: 'is_free', label: 'Entrada Gratuita', type: 'boolean', required: true },
        { name: 'contact', label: 'Contacto', type: 'text', required: true },

    ],
    // listing_type_id = 3 (asumimos que es "trabajos")
    '2': [
        { name: 'salary_range', label: 'Rango Salarial', type: 'text', required: false },
        { name: 'job_type', label: 'Tipo de Contrato', type: 'select', options: ['Full-Time', 'Part-Time'], required: true }
    ],
    // Bienes raices
    '3': [
        { name: 'salary_range', label: 'Rango Salarial', type: 'text', required: false },
        { name: 'm2', label: 'M2', type: 'integer', required: true },
        { name: 'room', label: 'Habitaciones', type: 'integer', required: true },
        { name: 'bathroom', label: 'Baños', type: 'integer', required: true },
        { name: 'house_type', label: 'Tipo de Vivienda', type: 'select', options: ['Casa', 'Terreno', 'Departamento', 'Galpón', 'Comercio','Chacra'], required: true },
        { name: 'type', label: 'Tipo de Contrato', type: 'select', options: ['Alquiler', 'Venta'], required: true },
        { name: 'price_sale', label: 'Precio de Venta', type: 'text', required: false },
        { name: 'price_rent', label: 'Precio del Alquiler', type: 'text', required: false },
    ],
    // Vehículos
    '5': [
        { name: 'type', label: 'Tipo', type: 'select', options: ['Auto', 'Moto','Cuatricilo','Bicicleta','Camión','Casilla','Colectivo','otro'], required: true },
        { name: 'car_brand', label: 'Marca', type: 'select', options: ['Toyota', 'Honda','Chevrolet','BMW','Mercedes Benz','Nissan','Volkswagen','Hyundai','Kia','Tesla','Ford','Fiat','Renault','Suzuki','otro'], required: true },
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


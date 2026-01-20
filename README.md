# LabGuard Frontend

Portal web construido con React + Vite para reproducir las pantallas de **Inicio de Sesión** y **Panel de Recepción** mostradas en los diseños de referencia.

## Requisitos previos

- Node.js 18+
- npm (incluido con Node)

## Scripts principales

- `npm install` – instala dependencias.
- `npm run dev` – levanta el servidor de desarrollo en `http://localhost:5174`.
- `npm run build` – genera la versión lista para producción.
- `npm run preview` – sirve la compilación generada.

## Estructura relevante

- `src/pages/Login.jsx` – vista del inicio de sesión con panel izquierdo y hero animado.
- `src/pages/ReceptionDashboard.jsx` – dashboard para recepción con tabla de muestras recientes.
- `src/styles/` – variables globales (`base.css`) y estilos específicos de cada vista.

La navegación entre vistas se maneja con `react-router-dom` (`/` para login y `/recepcion` para el dashboard).

## Personalización

- Actualiza los textos fijos o los datos de la tabla en los componentes correspondientes.
- Cambia la imagen hero modificando la propiedad `background-image` en `src/styles/login.css`.
- Ajusta la paleta de colores editando las variables definidas en `src/styles/base.css`.

## Próximos pasos sugeridos

1. Conectar el formulario de acceso a la API real de autenticación.
2. Consumir datos dinámicos para la tabla de muestras.
3. Agregar páginas para los demás roles (analista, administrador, etc.) reutilizando la misma base de estilos.

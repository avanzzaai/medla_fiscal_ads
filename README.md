# MEDLA · Asesoría Fiscal: landing de ads

Página estática (HTML + CSS + GSAP por CDN), sin backend y sin conexión con la API de HighLevel.
Conversión principal: reservar y pagar la **sesión de asesoría fiscal online de 60 minutos (121 €,
IVA incluido)** en el widget público del calendario de HighLevel (`ExwwLZ24X6UPcOY0UGEj`).
Secundaria: escribir por WhatsApp o llamar al +34 914 32 14 57.

- Producción: https://medla-fiscal-ads.vercel.app/ (proyecto `medla-fiscal-ads`, equipo avanzza-ai).
  Cada push a `main` despliega a producción.
- Dirección de diseño: `DESIGN.md`. Copy y fuente de cada dato: `COPY.md`.
- Fondo `#F9F8F6` (el claro de MEDLA) y tema claro siempre, aunque el sistema esté en modo oscuro.

## Embudo

| URL | Qué es | Llegan desde |
|---|---|---|
| `/` | Landing | Anuncios |
| `/reservar/?cta=<origen>` | Calendario de reserva y pago | Todos los botones "Reservo mi sesión" |
| `/whatsapp/?cta=<origen>&tema=<tema>` | Agradecimiento + salto a WhatsApp (2,4 s) con el mensaje ya escrito | Todos los "Escribir por WhatsApp" |
| `/gracias/` | Agradecimiento tras reservar | El calendario, al completar la reserva |

- `cta` dice qué botón se pulsó: `header`, `hero`, `problema`, `card-renta`, `card-autonomos`,
  `card-herencias`, `card-extranjeros`, `ticket`, `medla`, `resenas`, `reserva`, `faq`, `cierre`,
  `dock`, `reservar`, `reservar-faq`, `whatsapp`.
- `tema` (solo WhatsApp) cambia el mensaje: `renta`, `autonomos`, `herencias`, `extranjeros`, `duda`.
- Los UTM y click-ids de la visita (`utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`,
  `ttclid`) viajan a cada sub-página, y el calendario de `/reservar/` los lee de la URL.
- El calendario completo sigue también al final de la landing; reservar ahí también lleva a `/gracias/`.
- El salto a `/gracias/` lo hace la página al recibir el aviso público del widget
  (`postMessage(["msgsndr-booking-complete", …])`, solo si viene del iframe del calendario). No hace
  falta configurar redirección en HighLevel; si se configura, que apunte a `/gracias/`.
- La reserva hecha desde "Ábrelo en una pestaña nueva" (página de HighLevel) no pasa por `/gracias/`.

## Medición

Reglas por URL (GTM, Meta, Google Ads), siempre con "contiene", porque llevan parámetros:

| Conversión | Regla |
|---|---|
| Intención de reserva | URL contiene `/reservar/` |
| Lead de WhatsApp | URL contiene `/whatsapp/` |
| Reserva pagada | URL contiene `/gracias/` |

Además, `assets/core.js` empuja a `dataLayer` (y a `fbq`, si el píxel está instalado):

| Evento `dataLayer` | Dónde | Meta |
|---|---|---|
| `cta_click` (`cta`) | Clic en "Reservo mi sesión" | `CTAClick` (custom) |
| `whatsapp_cta` (`cta`) | Clic en "Escribir por WhatsApp" | — |
| `tel_click` | Clic en el teléfono (landing y /reservar/) | `Contact` |
| `booking_page` (`cta`) | Llegada a /reservar/ | `InitiateCheckout` (121 EUR) |
| `booking_view` | Carga del calendario | — |
| `booking_submitted` | Aviso del calendario, justo antes de ir a /gracias/ | — |
| `whatsapp_lead` (`cta`, `tema`) | Llegada a /whatsapp/ | `Contact` |
| `booking_complete` | Llegada a /gracias/ desde el calendario (una sola vez) | `Purchase` (121 EUR) |
| `whatsapp_soporte`, `tel_soporte` | Contacto desde /gracias/ (no son leads nuevos) | — |

Volver con "atrás" a /reservar/ o /whatsapp/ no repite el evento, y recargar /gracias/ no repite
la venta (las reglas por URL de GTM sí contarían esas recargas). Si el píxel también se configura
dentro del calendario de HighLevel, el widget envía su propio `Schedule`.

Falta pegar el GTM o el píxel de MEDLA (con su banner de cookies) en las cuatro páginas.

## Estructura

```
index.html              landing
reservar/index.html     calendario de reserva
whatsapp/index.html     agradecimiento + salto a WhatsApp
gracias/index.html      agradecimiento tras reservar
assets/core.js          común: medición, plazo fiscal, enlaces con UTM, calendario, salto a /gracias/
assets/landing.js       landing: barra móvil, reseñas, motion GSAP
assets/pages.js         sub-páginas: eventos de llegada, mensaje y salto de WhatsApp
assets/landing.css      sistema de diseño (tokens, componentes)
assets/pages.css        estilos de las sub-páginas
assets/icons.svg        sprite de íconos Phosphor
assets/img/             fotografías propias (WebP), logos, favicons, imagen Open Graph
vercel.json             URLs con barra final, cabeceras y caché de imágenes
```

## Local

Dentro de esta carpeta: `python3 -m http.server 4329` → http://localhost:4329/
(abrir `index.html` con doble clic no carga los íconos: el navegador bloquea el sprite en `file://`).

## Si cambia el dominio

Actualizar `canonical`, `og:url`, `og:image`, `twitter:image` y el JSON-LD de `index.html`, y
`canonical` / `og:url` de las tres sub-páginas.

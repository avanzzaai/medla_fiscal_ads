# MEDLA · Asesoría Fiscal: landing de ads

Página estática (HTML + CSS + GSAP por CDN) con una función de Vercel para el formulario.
Conversión principal: reservar y pagar la **sesión de asesoría fiscal online de 60 minutos (121 €,
IVA incluido)** en el calendario de HighLevel `ExwwLZ24X6UPcOY0UGEj`, incrustado en `#reservar`.
Secundaria: formulario "Prefiero que me llamen" → `POST /api/form/fiscal` → HighLevel.

- Producción: https://medla-fiscal-ads.vercel.app/ (proyecto `medla-fiscal-ads`, equipo avanzza-ai).
  Cada push a `main` despliega a producción.
- Dirección de diseño: `DESIGN.md`. Copy y fuente de cada dato: `COPY.md`.

## Estructura

```
index.html              la página
assets/landing.css      estilos (tokens claro/oscuro)
assets/landing.js       plazo fiscal en vivo, pestañas, calendario, formulario, reseñas, motion GSAP
assets/icons.svg        sprite de íconos Phosphor
assets/img/             fotografías propias (WebP), logos, favicons, imagen Open Graph
api/form.py             función de Vercel: valida y envía el lead a HighLevel
api/_forms.py           validación (solo el formulario "fiscal")
api/_crm.py             puente con HighLevel (contacto, nota, oportunidad y tarea)
api/ghl.json            IDs de HighLevel (sin secretos)
vercel.json             reescritura /api/form/:name, cabeceras y caché de imágenes
```

## Variables de entorno (Vercel)

| Variable | Para qué |
|---|---|
| `GHL_PIT` | Token de integración privada de la sub-cuenta MEDLA Asesores. Sin él, el formulario responde con error y la página ofrece teléfono y WhatsApp. El calendario de pago funciona igual. |

## Local

- Dentro de esta carpeta: `python3 -m http.server 4327` → http://localhost:4327/ (sin la función del formulario).
- Con formulario: el sitio local de MEDLA la sirve en http://localhost:4324/lp/asesoria-fiscal/
  (`medla-asesores/src/landings/asesoria-fiscal` es un enlace simbólico a esta carpeta y `build.py` la copia).
- QA con motion real a 375/768/1440: `SCHEME=light node ../medla-asesores/tools/qa_landing.mjs lp/asesoria-fiscal/ /tmp/qa`.

## Medición

Cada CTA lleva `data-track`; `landing.js` empuja `cta_click`, `booking_view`, `tab_view`, `lead_submit`,
`tel_click` y `whatsapp_click` a `dataLayer` y, si existe `fbq`, envía `Lead` a Meta. Las UTM, `gclid` y
`fbclid` viajan con el lead a HighLevel. Falta pegar el GTM o píxel de MEDLA (con su banner de cookies).

## Si cambia el dominio

Actualizar `canonical`, `og:url`, `og:image`, `twitter:image` y el JSON-LD de `index.html`.

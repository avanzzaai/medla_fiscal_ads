# DESIGN.md · Landing Asesoría Fiscal (MEDLA) · v2

> Landing de venta para tráfico de anuncios. Producto: **sesión de asesoría fiscal online de
> 60 minutos, 121 € IVA incluido** (informe detallado + estrategia fiscal inicial), que se reserva y
> paga en la propia página (calendario GHL `ExwwLZ24X6UPcOY0UGEj`, Stripe).
> URL: `/lp/asesoria-fiscal/` · fuente `src/landings/asesoria-fiscal/` · `noindex`.
> v1 (lienzo cuadrado tipo Baselayer) guardada en `.design-loop/v0-baseline/`.

## Por qué cambió (feedback del cliente sobre v1)

"Demasiado cuadrada, sosa, no me gusta la estructura." Diagnóstico:

| Problema v1 | Causa | Respuesta v2 |
|---|---|---|
| Cuadrada | Cards a 0 px, filetes de 1 px en todo, retícula técnica | Sistema suave: paneles de 40 px, cards de 28 px, controles en píldora, profundidad con sombras teñidas |
| Sosa | Casi todo texto sobre blanco, fotos de stock, mono frío | Fotografía propia y coherente (5 imágenes generadas), marfil cálido, dorado vivo de la guía de marca, serif de alto contraste |
| Estructura | Muchas listas seguidas (preguntas, pasos, FAQ) con el mismo ritmo | Arco de venta con 10 familias de layout distintas y un momento fuerte por sección |
| Servicios difusos | Seis preguntas de nicho (Beckham, 210, 720...) al mismo nivel | Cuatro pilares ordenados por demanda real (Google Trends) |

## 0 · Design Read

**Leyendo esto como:** landing de conversión para personas en España con un problema fiscal concreto
(Renta, trimestres de autónomo, herencia, llegada desde otro país), con un lenguaje **cálido,
editorial y fotográfico** (paneles redondeados tipo Lawfirma, jerarquía editorial de Baselayer),
en HTML/CSS/JS estático + GSAP 3.13 (ScrollTrigger, SplitText).

| Dial | Valor | Por qué |
|---|---|---|
| DESIGN_VARIANCE | 7 | Paneles enmarcados, tarjetas apiladas, collage. El botón nunca se esconde. |
| MOTION_INTENSITY | 7 | Cada sección tiene un momento propio (apilado, subrayado por scroll, línea de proceso). |
| VISUAL_DENSITY | 4 | Una idea por pantalla. |

## 1 · Demanda que ordena los servicios

Google Trends, España, últimos 12 meses (hasta sept. 2026). Escala común (impuesto de sucesiones = 1,00):

| Pilar | Términos | Índice |
|---|---|---|
| Declaración de la Renta | declaración de la renta | **6,90** (pico en abril) |
| Autónomos | modelo 303 (0,85) + modelo 130 (0,49) + alta de autónomo (0,22) | **1,56** (picos trimestrales) |
| Herencias y donaciones | impuesto de sucesiones (1,00) + impuesto de donaciones (0,43) | **1,43** (estable todo el año) |
| Extranjeros y no residentes | residencia fiscal (0,33) + modelo 720 (0,27) + modelo 210 (0,22) + Ley Beckham (0,10) | **0,92** (especialidad de MEDLA: fiscal + extranjería) |
| Descartado | requerimiento de Hacienda (0,04), cripto (≈0) | Pasan a la FAQ |

## 2 · Tokens

| Token | Claro | Oscuro | Rol |
|---|---|---|---|
| `--ink` / `--navy` | `#142D37` | `#EFEBE2` / `#17323D` | Texto y paneles navy |
| `--navy-deep` | `#0B1D24` | `#0E2129` | Hero, cierre, tarjeta de extranjeros |
| `--ivory` | `#F4F1EA` | `#0B171C` | Lienzo |
| `--paper` | `#FFFFFF` | `#12242B` | Tarjetas |
| `--gold` | `#C9A84C` | `#D2B25A` | Acento único: acción, dato, palabra clave |
| `--gold-ink` | `#7D6219` | `#D2B25A` | Dorado para texto pequeño sobre claro (5,1:1) |
| `--muted` | `#586A70` | `#A8B5B9` | Texto secundario (5,0:1 sobre marfil) |

Arena (`--sand`) = mezcla de dorado y marfil, solo para la tarjeta de herencias.

**Tipo:** DM Serif Display (la display del sitio de MEDLA; itálica en dorado para la palabra clave) +
DM Sans 400–700. H1 `clamp(3.4rem, 8.4vw, 8rem)`, H2 `clamp(2.4rem, 5vw, 4.4rem)`, tracking −0,02 em.
**Forma:** paneles 40 px (28 px móvil), tarjetas 28 px, imágenes internas 20 px, botones y chips en
píldora. Botón con ícono en su propio círculo. Sombras teñidas de navy, nunca negras.
**Íconos:** Phosphor (misma librería del sitio) como sprite SVG local (`assets/icons.svg`).

## 3 · Estructura (arco de venta)

1. **Hero inmersivo** · panel redondeado con foto propia (videollamada con la asesora = el producto).
   H1 "Hacienda, sin sustos." + tarjeta flotante con el **próximo plazo fiscal en vivo**.
2. **Marquesina** de consultas ordenadas por demanda (la única de la página).
3. **Problema** · frase que se ilumina palabra a palabra con el scroll + 3 datos con su artículo de ley.
4. **Servicios** · 4 tarjetas que se apilan (sticky stack) con foto, gancho, dato verificado y fuente.
5. **Oferta** · ticket de 121 € fijo mientras la línea de 3 pasos se dibuja con el scroll.
6. **Por qué MEDLA** · panel oscuro: fiscal + extranjería, cifras y collage con parallax.
7. **Reseñas** · carrusel arrastrable con las reseñas reales de Google.
8. **Reservar** · panel de doble bisel: pestañas píldora (pagar / que me llamen).
9. **FAQ** · acordeón + tarjeta de contacto directo.
10. **Cierre** · panel con Madrid de fondo, plazo en vivo y último CTA.

## 4 · Motion

| Momento | Técnica | Easing |
|---|---|---|
| Entrada | panel del hero escala 0,96→1, foto 1,12→1, palabras del H1 suben con máscara | `expo.out` 1,1 s |
| Hero en scroll | panel se recoge (escala 0,94), foto en parallax, tarjetas a distinta velocidad | scrub |
| Marquesina | bucle continuo que acelera con la velocidad del scroll | `none` (velocidad constante) |
| Problema | palabras de 15 % a 100 % de opacidad atadas al scroll | scrub |
| Servicios | `position: sticky` + la tarjeta anterior se reduce y se oscurece al llegar la siguiente | scrub |
| Oferta | línea de pasos `scaleY` + íconos que se encienden; ticket con inclinación al cursor | scrub / `power3.out` |
| Por qué | contadores + fotos del collage a velocidades distintas | `power2.out` / scrub |
| Micro | botones magnéticos, píldora de pestañas, acordeón, flechas que se desplazan | 0,2–0,45 s |

`gsap.matchMedia()` con `desktop` + `compact` + `reduce` (cobertura total). Con movimiento reducido
todo queda en estado final; el apilado sigue funcionando porque es CSS.

## 5 · Conversión

- Un intent, una etiqueta: **Reservo mi sesión** (header, hero, tarjetas, ticket, cierre, barra móvil).
  Intent secundario: **Prefiero que me llamen** → formulario → `/api/form/fiscal` → HighLevel.
- Plazo fiscal real y dinámico (`data-dl`): 30 ene, 31 mar, 20 abr, 30 jun, 20 jul, 20 oct, con
  traslado a lunes si cae en fin de semana.
- Las tarjetas de servicio guardan el tema elegido y lo preseleccionan en el formulario.
- UTM, `gclid` y `fbclid` viajan con el lead. Eventos `dataLayer`/`fbq` si existen.

## 6 · Fuentes del copy

Ver `COPY.md` (cada dato con su fuente oficial).

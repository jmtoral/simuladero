# simuladero

Simulaciones Monte Carlo de fenómenos operativos, para mover parámetros y ver qué pasa.
Cada simulador es una página HTML autocontenida: no hay build ni dependencias que instalar.

**En línea:** https://jmtoral.github.io/simuladero/

## Simuladores

| Fenómeno | Página | Qué responde |
|---|---|---|
| Tiempo de mercado de una ruta | [`ruta/`](ruta/) | Cómo el stay time de cada cliente y los traslados arman la jornada, cuánto varía de un día a otro y qué tan bueno es un plan según el modelo de stay times que lo arma. |
| Flota y calidad de predicción | [`flota/`](flota/) | Cuántos clientes caben por ruta y cuánta flota se ahorra según qué tan bien se predice el stay time. |
| Luz estructurada (SCARED) | [`luz-estructurada/`](luz-estructurada/) | Cómo se obtuvo la profundidad verdadera del reto SCARED (MICCAI 2019): 10 patrones de código Gray, un endoscopio estéreo y Z = f·B/d. Figura interactiva. |

Las versiones anteriores siguen publicadas en [`legacy/`](legacy/).

## Tiempo de mercado de una ruta

Una sola ruta, simulada miles de días:

```
T   = STEM₁ + Σ Sᵢ + Σ Dⱼ + C + STEM₂
Sᵢ  = t_fijo + t_var · Qᵢ + Wᵢ
```

| Variable | Distribución |
|---|---|
| Cajas Qᵢ | Lognormal (media y CV), redondeada a entero |
| Residual Wᵢ (espera, cobro, firma…) | Lognormal (media y CV) |
| Traslado Dⱼ entre clientes | Lognormal con media d × peso del tramo y CV común |
| STEM₁, STEM₂ | Lognormal con su media y el mismo CV de los traslados |
| Peso de cada tramo | Fijo para la ruta, promedia 1 (d es el traslado promedio) |
| Comida C | Constante |

La página incluye:

- **Un día en la ruta:** un diorama isométrico (CEDIS, calles, una tiendita por cliente) con el camión recorriendo el día simulado, y el mismo día como diagrama de línea.
- **Miles de días:** histograma del tiempo de mercado contra la curva teórica, promedio, desviación, rango típico y días que pasan la jornada.
- **Anatomía del tiempo de mercado:** de qué está hecho el día promedio y de dónde viene la variación.
- **¿Qué tan bueno es el plan?:** los mismos días planeados con tres modelos de stay time (promedio único, modelo con cajas, perfecto), con controles de sesgo y ruido del modelo.

### Cambiar los valores

- **De fábrica:** el bloque `PARAMS` al inicio de [`ruta/motor.js`](ruta/motor.js) define cada valor por defecto y el rango de su control.
- **Un escenario:** mueve los controles y usa «Copiar enlace»; el escenario queda en la URL.

### Verificar el motor

```
node ruta/prueba.js
```

Comprueba que cada día cuadra con la fórmula, que la media y la desviación simuladas coinciden con la teoría y que el error de cada modelo de plan es el esperado.

## Estructura

```
index.html            portada de la colección
ruta/
  index.html          página del simulador
  motor.js            modelo y simulación (JS puro, también corre en Node)
  diorama.js          diorama isométrico
  prueba.js           verificaciones del motor
  vendor/             kit isométrico de terceros
flota/index.html      simulador de flota
luz-estructurada/
  index.html          figura interactiva en inglés (generada)
  fuente/             build.mjs, modelo.mjs, vivo.js, estilo.css, prueba.mjs y el kit
legacy/               versiones anteriores
```

Para usarlo localmente basta abrir `index.html` en el navegador.

## Créditos

El diorama usa el kit isométrico de [anatomy](https://github.com/wheresryan22/anatomy) (MIT, © 2026 Ryan), copiado en [`ruta/vendor/`](ruta/vendor/) y [`luz-estructurada/fuente/kit/`](luz-estructurada/fuente/kit/) con su licencia.

Para regenerar la figura de luz estructurada: `node luz-estructurada/fuente/build.mjs` (agrega `--audit` para verificar la geometría y `--dark` para el tema oscuro); `node luz-estructurada/fuente/prueba.mjs` verifica el modelo.

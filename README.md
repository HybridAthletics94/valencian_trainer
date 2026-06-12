# Entrenador de valenciano para oposición — versión ampliada

Esta carpeta contiene una app web estática para preparar valenciano desde el móvil y un banco de preguntas **original**.

## Qué incluye

- App móvil en `index.html`.
- Carga automática de múltiples CSV desde `data/manifest.json`.
- Banco combinado en `data/examenes.csv`.
- 440 preguntas/actividades originales.
- Niveles: B2, C1 y C2.
- Temas: acentuación, ortografía, apostrofación, verbos, pronoms febles, léxico, fraseología, sintaxis, conectores, preposiciones, puntuación, corrección de errores, comprensión escrita, expresión escrita y oral.
- Modo normal, aleatorio, solo fallos e inteligente.
- Modo pendientes para mezclar preguntas nuevas y preguntas aún no dominadas.
- Progreso por pregunta con intentos, racha, estado y temas débiles.
- Simulacros B2, C1 y C2 con tiempo y resumen por bloques.
- Fichas teóricas, conectores, rúbrica, modelos de redacción y simulacros por nivel.
- Buscador interno por palabra o tema.
- Exportación de fallos a CSV.
- Exportación/importación de progreso para cambiar de móvil o navegador.

## Uso rápido

1. Abre `index.html`.
2. Usa **10 aleatorias** para empezar rápido o ajusta nivel, tema y modo.
3. Pulsa **Empezar**.
4. Si quieres añadir tus propias preguntas, abre **Banco** e importa tus CSVs.

Una pregunta pasa a **Dominada** tras dos aciertos seguidos. Si fallas, vuelve a **En repaso**.

El modo **Inteligente** prioriza fallos recientes y preguntas en repaso, introduce preguntas nuevas y deja las dominadas para el final. Los límites de 5, 10 y 15 minutos son sesiones cortas aproximadas: 8, 15 y 25 preguntas.

Los **simulacros** cargan los CSV de `simulacros/`, ocultan la corrección inmediata y muestran un resumen final por temas.

## Copias y portabilidad

En la sección **Progreso** puedes:

- **Exportar progreso**: descarga un JSON con tu historial, rachas, fallos y preguntas dominadas.
- **Importar progreso**: carga ese JSON en otro navegador o móvil.
- **Exportar banco**: descarga todo el banco cargado como CSV.
- **Reiniciar selección**: borra solo el progreso del nivel/tema elegido en los filtros de práctica.

El progreso no se sube a ningún servidor; se guarda en el navegador y solo sale del dispositivo cuando lo exportas.

En algunos móviles, abrir `index.html` directamente puede bloquear la carga automática de los CSV por seguridad del navegador. En ese caso, importa `data/examenes.csv` manualmente o súbelo a GitHub Pages/Netlify.

## Instalar en el móvil

Cuando esté publicado por HTTPS, por ejemplo en GitHub Pages:

- En iPhone: abre la web en Safari, comparte y elige **Añadir a pantalla de inicio**.
- En Android: abre la web en Chrome y usa **Instalar app** o **Añadir a pantalla de inicio**.

La app guarda la interfaz y todos los CSV del banco para poder practicar sin conexión. Si publicas cambios nuevos, aparecerá un aviso para actualizar la app instalada.

## Publicar en GitHub Pages

Antes de subir cambios, ejecuta:

```bash
node scripts/validate-bank.mjs
node scripts/audit-content.mjs
node scripts/verify-publish.mjs
```

Para publicar:

1. Crea un repositorio en GitHub.
2. Sube esta carpeta al repositorio.
3. En GitHub, abre **Settings > Pages**.
4. Elige **Deploy from a branch**.
5. Selecciona la rama principal y la carpeta raíz.
6. Abre la URL generada por GitHub Pages en el móvil.
7. Añade la web a la pantalla de inicio.

El archivo `.nojekyll` evita que GitHub Pages trate carpetas o archivos como contenido Jekyll.

Para el primer envío desde esta carpeta:

```bash
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Consulta `DEPLOY.md` para la lista completa de comprobación en móvil.

## Formato CSV

```text
id,nivel,tema,tipo,pregunta,opcion_a,opcion_b,opcion_c,opcion_d,respuesta,explicacion,fuente
```

Tipos admitidos:

- `test`: respuesta A, B, C o D.
- `hueco`: completar una palabra o expresión.
- `texto`: corrección o transformación escrita con respuesta esperada.
- `redaccio`: práctica abierta de expresión escrita.
- `oral`: práctica abierta de expresión oral.

En preguntas `hueco` y `texto`, puedes aceptar varias respuestas válidas separándolas con `|`, por ejemplo:

```text
perquè|per que
```

Las preguntas `redaccio`, `oral` y las respuestas de texto demasiado largas se tratan como autoevaluación guiada.

## Cómo ampliarlo con exámenes oficiales o material propio

No he incluido exámenes oficiales completos para evitar problemas de derechos de uso. Puedes convertir en CSV solo material que tengas derecho a reutilizar.

Para añadir un CSV permanente:

1. Guárdalo dentro de `data/`.
2. Añade su ruta en `data/manifest.json`.
3. Recarga la app.

Para añadirlo sin tocar archivos, usa **Importar CSVs** desde la app.

## Validar el banco antes de publicar

Puedes revisar todos los CSV del manifest con:

```bash
node scripts/validate-bank.mjs
node scripts/audit-content.mjs
```

La app también muestra un diagnóstico del banco al cargar: archivos cargados, preguntas válidas, niveles, tipos y errores de formato si los hay.
La auditoría pedagógica genera `CONTENT_AUDIT.md` con cobertura por nivel, tipo y tema.

## Licencia

Código y materiales del proyecto bajo licencia MIT. El banco es material original de práctica y no incluye exámenes oficiales completos.

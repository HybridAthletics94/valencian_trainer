# Publicación en GitHub Pages

## Comprobación previa

Ejecuta siempre:

```bash
node scripts/validate-bank.mjs
node scripts/audit-content.mjs
node scripts/verify-publish.mjs
```

El resultado esperado es:

```text
Banco validado: 440/440 preguntas válidas
Listo para publicar como app estática.
```

## Primer push

1. Crea un repositorio vacío en GitHub.
2. Copia la URL del repositorio.
3. Desde esta carpeta:

```bash
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

## Activar GitHub Pages

1. En GitHub, abre **Settings > Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona la rama `main`.
4. Selecciona la carpeta `/ (root)`.
5. Guarda.

GitHub publicará una URL parecida a:

```text
https://TU_USUARIO.github.io/TU_REPO/
```

## Comprobación en móvil

1. Abre la URL publicada.
2. Inicia una práctica rápida.
3. Inicia un simulacro.
4. Activa modo avión y recarga la app.
5. Comprueba que el banco sigue cargando.
6. Añade la web a la pantalla de inicio.

## Actualizaciones

Cuando cambies `app.js`, `styles.css`, `index.html`, datos o simulacros, sube la versión de caché en `service-worker.js`:

```js
const CACHE = "valenciano-trainer-v11";
```

Así la app instalada mostrará el aviso de actualización.

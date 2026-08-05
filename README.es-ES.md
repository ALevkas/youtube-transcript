

# YouTube Transcript to LLM

Extensión de Chrome para enviar transcripciones de videos de YouTube a un LLM (ChatGPT, Claude, Gemini) para su análisis.

## Características

- Extracción de la transcripción del video de YouTube con un solo clic
- Soporte para subtítulos generados automáticamente y manuales
- Envío a ChatGPT, Claude o Gemini
- Plantillas de prompts personalizables
- 5 prompts predeterminados:
  - **Resumen** — resumen breve del video
  - **Puntos clave** — destacado de las ideas principales
  - **Preguntas y respuestas** — modo de preguntas y respuestas
  - **Traducción** — traducción de la transcripción
  - **Apuntes** — notas estructuradas

## Instalación

### Para desarrollo

1. Clona el repositorio:
```bash
git clone <repo-url>
cd youtube-transcript-llm
```

2. Instala las dependencias:
```bash
npm install
```

3. Construye la extensión:
```bash
npm run build
```

4. Carga en Chrome:
   - Abre `chrome://extensions/`
   - Habilita el "Modo de desarrollador"
   - Haz clic en "Cargar desempaquetado"
   - Selecciona la carpeta `dist/`

### Para producción

```bash
npm run build
```

Carga la carpeta `dist/` como extensión desempaquetada o crea un ZIP para su publicación.

## Uso

1. Abre cualquier video de YouTube
2. Haz clic en el icono de la extensión
3. Selecciona el proveedor de LLM (ChatGPT/Claude/Gemini)
4. Selecciona una plantilla de prompt
5. Haz clic en "Send to LLM"

La extensión automáticamente:
- Extraerá la transcripción del video
- Abrirá el LLM seleccionado en una nueva pestaña
- Insertará el prompt con la transcripción

## Gestión de prompts

Haz clic en "Manage Prompts" para:
- Ver todos los prompts
- Agregar tus propias plantillas
- Editar/eliminar prompts personalizados

### Variables disponibles

| Variable | Descripción |
|------------|----------|
| `{video_title}` | Título del video |
| `{video_url}` | Enlace al video |
| `{channel_name}` | Nombre del canal |
| `{transcript}` | Texto de la transcripción |
| `{duration}` | Duración del video |

## Desarrollo

```bash
# Ejecutar pruebas
npm test

# Ejecutar pruebas una vez
npm run test:run

# Modo watch para TypeScript
npm run watch

# Limpiar dist
npm run clean
```

## Estructura del proyecto

```
src/
├── background/       # Service worker
├── content/          # Content scripts
│   ├── content.ts    # Extracción de la transcripción de YouTube
│   └── llm-injector.ts # Inyección del prompt en el LLM
├── popup/            # Popup UI
├── config/           # Configuración (proveedores, prompts)
└── types/            # Tipos de TypeScript
```

## Detalles técnicos

- Manifest V3
- TypeScript
- Vitest para pruebas
- chrome.storage.sync para sincronización de configuraciones

## Licencia

MIT

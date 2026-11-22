// Errores del servidor MCP de TIB. Solo el mensaje de estos errores se devuelve al asistente:
// el resto puede llevar URLs, cabeceras o datos internos.

/** El asistente usó mal la herramienta (parámetro no válido, parada o línea inexistente). */
export class UsageError extends Error {}

/** La fuente de datos (el GTFS de TIB) no se pudo obtener o leer. */
export class SourceError extends Error {}

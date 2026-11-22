import { requireElements, textOf } from '@reforma-digital/bridge';

/** Selectores del catálogo de servicios (www2 · ServiciosAsocCat), verificados el 2026-09-27. */
const CATALOGO = {
  title: 'main#acc-main h1#js-nombre-canal',
  description: '#js-descripcion-canal',
  carousel: '#CarruselRelacionServicios',
} as const;
/** Cada servicio es un web component oficial que la página rellena por JavaScript. */
const SERVICE = 'service-web-component';
const REQUEST = 'button.btn-primary';

interface Service {
  /** Código del servicio (id de la tarjeta oficial, p. ej. A296). */
  id: string;
  name: string;
  description: string;
  note: string;
  category: string;
  /** Canales tal como los nombra la web oficial («Videollamada», «Atención en Oficina»…). */
  channels: string[];
  /** Botón oficial «Solicita asistencia y cita». */
  request: HTMLButtonElement;
  /** Título oficial del botón («Solicitar asistencia y cita para …»): nombre accesible único. */
  requestLabel: string;
}

export interface CatalogoBindings {
  title: HTMLElement;
  description: HTMLElement;
  carousel: HTMLElement;
  services: Service[];
  categories: string[];
  channels: string[];
}

export function catalogoBindings(document: Document): CatalogoBindings | null {
  const els = requireElements(document, CATALOGO);
  if (!els) return null;
  const services: Service[] = [];
  for (const component of Array.from(els.carousel.querySelectorAll(SERVICE))) {
    const request = component.querySelector(REQUEST);
    const id = component.querySelector('.card')?.id;
    const name = component.getAttribute('name')?.trim();
    // Contenido aún no pintado o estructura distinta: se mantiene la página original.
    if (!(request instanceof HTMLButtonElement) || !id || !name) return null;
    services.push({
      id,
      name,
      description: component.getAttribute('description')?.trim() ?? '',
      note: component.getAttribute('note')?.trim() ?? '',
      category: textOf(component.closest('.carousel-item')?.querySelector('h2')),
      channels: channelsOf(component.getAttribute('channels')),
      request,
      requestLabel: request.title.trim() || `Solicita asistencia y cita: ${name}`,
    });
  }
  if (!services.length || new Set(services.map((s) => s.id)).size !== services.length) return null;
  return {
    title: els.title,
    description: els.description,
    carousel: els.carousel,
    services,
    categories: unique(services.map((s) => s.category).filter(Boolean)),
    channels: unique(services.flatMap((s) => s.channels)),
  };
}

function channelsOf(json: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(json ?? '[]');
    return Array.isArray(parsed)
      ? parsed.map((c) => (typeof c?.leyenda === 'string' ? c.leyenda.trim() : '')).filter(Boolean)
      : [];
  } catch (error) {
    // Un atributo que no es JSON no aporta canales.
    if (error instanceof SyntaxError) return [];
    throw error;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

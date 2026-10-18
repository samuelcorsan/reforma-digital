import { describe, expect, it } from 'vitest';
import { llamar, pareceIrreversible, type InfoElemento } from './page';

const destino = () => (0, eval)(llamar('destinoDeTecla')) as InfoElemento | null;
const marco = (html: string) => {
  document.body.innerHTML = '<iframe></iframe>';
  const f = document.querySelector('iframe')!;
  f.contentDocument!.body.innerHTML = html;
  return f;
};

describe('destino de Intro y Espacio', () => {
  it('ve el formulario de un marco de la misma web', () => {
    const f = marco('<form><input><button>Enviar solicitud</button></form>');
    f.contentDocument!.querySelector('input')!.focus();
    const d = destino();
    expect(d?.nombre).toBe('Enviar solicitud');
    expect(pareceIrreversible(d!)).toBe(true);
  });

  it('ve el botón dentro de un shadow DOM abierto', () => {
    document.body.innerHTML = '<div></div>';
    const raiz = document.querySelector('div')!.attachShadow({ mode: 'open' });
    raiz.innerHTML = '<button>Firmar y enviar</button>';
    raiz.querySelector('button')!.focus();
    expect(pareceIrreversible(destino()!)).toBe(true);
  });

  it('pide el código si el foco está donde no se ve', () => {
    const f = marco('<input>');
    f.contentDocument!.querySelector('input')!.focus();
    Object.defineProperty(f, 'contentDocument', {
      get: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
    expect(pareceIrreversible(destino()!)).toBe(true);

    document.body.innerHTML = '<div></div>';
    const raiz = document.querySelector('div')!.attachShadow({ mode: 'closed' });
    raiz.innerHTML = '<button>Siguiente</button>';
    raiz.querySelector('button')!.focus();
    expect(pareceIrreversible(destino()!)).toBe(true);
  });

  it('no pide nada a un campo suelto ni a un botón que no envía', () => {
    document.body.innerHTML = '<input><button>Buscar</button>';
    document.querySelector('input')!.focus();
    expect(destino()).toBeNull();
    document.querySelector('button')!.focus();
    expect(pareceIrreversible(destino()!)).toBe(false);
  });
});

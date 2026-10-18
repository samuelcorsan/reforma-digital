import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomBridge, fieldByLabel, isBindableField } from './index';

const bridges: DomBridge[] = [];
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const bridge = (
  fields: ConstructorParameters<typeof DomBridge>[0],
  actions: ConstructorParameters<typeof DomBridge>[1] = {},
  options: ConstructorParameters<typeof DomBridge>[2] = {},
) => {
  const b = new DomBridge(fields, actions, options);
  bridges.push(b);
  return b;
};
afterEach(() => {
  bridges.forEach((b) => b.dispose());
  bridges.length = 0;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('DOM bridge behavior', () => {
  it('keeps input/change handlers, hidden tokens, form ownership and original submitter', () => {
    document.body.innerHTML = `<form id="form"><input id="name" name="name"><input type="hidden" name="csrf" value="original-token"><button id="submit" name="action" value="continue">Continue</button></form>`;
    const input = el<HTMLInputElement>('name');
    const form = el<HTMLFormElement>('form');
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    let payload: FormData | undefined;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      payload = new FormData(form, (e as SubmitEvent).submitter);
    });
    const b = bridge(
      { name: { element: input, label: 'Name' } },
      { continue: { element: el<HTMLButtonElement>('submit'), label: 'Continue' } },
    );
    b.setValue('name', 'Ada');
    b.activate('continue');
    expect(events).toEqual(['input', 'change']);
    expect(payload?.get('name')).toBe('Ada');
    expect(payload?.get('csrf')).toBe('original-token');
    expect(payload?.get('action')).toBe('continue');
    expect(input.form).toBe(form);
  });
  it('respects HTML validation and cancelled original click handlers', () => {
    document.body.innerHTML = `<form><input id="name" required><button id="submit">Continue</button></form>`;
    const submit = vi.fn();
    document.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });
    const b = bridge(
      { name: { element: el<HTMLInputElement>('name'), label: 'Name' } },
      { submit: { element: el<HTMLButtonElement>('submit'), label: 'Continue' } },
    );
    b.activate('submit');
    expect(submit).not.toHaveBeenCalled();
    b.setValue('name', 'Ada');
    el('submit').addEventListener('click', (e) => e.preventDefault());
    b.activate('submit');
    expect(submit).not.toHaveBeenCalled();
  });
  it('detects property-only updates, constraints, options, disabled fieldsets and resets', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<form id="f"><fieldset id="set"><input id="name" value="Initial"><select id="select"><option value="a">A</option></select><button id="action">Go</button></fieldset></form>`;
    const input = el<HTMLInputElement>('name');
    const b = bridge(
      {
        name: { element: input, label: 'Name' },
        select: { element: el<HTMLSelectElement>('select'), label: 'Choice' },
      },
      { action: { element: el<HTMLButtonElement>('action'), label: 'Go' } },
    );
    const listener = vi.fn();
    b.subscribe(listener);
    input.value = 'Script value';
    await vi.advanceTimersByTimeAsync(160);
    expect(b.getField('name').value).toBe('Script value');
    el<HTMLFieldSetElement>('set').disabled = true;
    b.refresh();
    expect(b.getField('name').disabled).toBe(true);
    expect(b.setValue('name', 'No')).toBe(false);
    expect(b.activate('action')).toBe(false);
    el<HTMLFieldSetElement>('set').disabled = false;
    el<HTMLSelectElement>('select').add(new Option('B', 'b'));
    b.refresh();
    expect(b.getField('select').options).toHaveLength(2);
    el<HTMLFormElement>('f').reset();
    await vi.advanceTimersByTimeAsync(160);
    expect(b.getField('name').value).toBe('Initial');
    expect(listener).toHaveBeenCalled();
  });
  it('keeps radio exclusivity and checkbox click cancellation', () => {
    document.body.innerHTML = `<form><input id="a" name="radio" type="radio" checked><input id="b" name="radio" type="radio"><input id="check" type="checkbox"></form>`;
    const b = bridge({
      a: { element: el<HTMLInputElement>('a'), label: 'A' },
      b: { element: el<HTMLInputElement>('b'), label: 'B' },
      check: { element: el<HTMLInputElement>('check'), label: 'Check' },
    });
    b.setChecked('b', true);
    expect(b.getField('a').checked).toBe(false);
    expect(b.getField('b').checked).toBe(true);
    el('check').addEventListener('click', (e) => e.preventDefault());
    expect(b.setChecked('check', true)).toBe(false);
    expect(b.getField('check').checked).toBe(false);
  });
  it('supports multiple selections and refuses disabled options', () => {
    document.body.innerHTML = `<select multiple id="s"><option value="a">A</option><option value="b">B</option><optgroup disabled><option value="c">C</option></optgroup></select>`;
    const b = bridge({ s: { element: el<HTMLSelectElement>('s'), label: 'Select' } });
    expect(b.setValue('s', ['a', 'b'])).toBe(true);
    expect(b.getField('s').values).toEqual(['a', 'b']);
    expect(b.setValue('s', ['c'])).toBe(false);
    expect(b.getField('s').values).toEqual(['a', 'b']);
  });
  it('selects only the first enabled option when values repeat', () => {
    document.body.innerHTML = `<select id="s"><option value="">-</option><option value="a" id="ok">A</option><option value="a" disabled>A</option></select>`;
    const b = bridge({ s: { element: el<HTMLSelectElement>('s'), label: 'Select' } });
    expect(b.setValue('s', 'a')).toBe(true);
    expect(el<HTMLSelectElement>('s').selectedOptions[0]?.id).toBe('ok');
  });
  it('does not bind secrets, hidden inputs, files or browser-controlled widgets', () => {
    for (const type of [
      'hidden',
      'password',
      'file',
      'date',
      'datetime-local',
      'color',
      'range',
      'number',
    ]) {
      const input = document.createElement('input');
      input.type = type;
      document.body.append(input);
      expect(isBindableField(input)).toBe(false);
      expect(() => bridge({ field: { element: input, label: 'Field' } })).toThrow();
    }
  });
  it('fails closed when a field disappears or changes identity', () => {
    document.body.innerHTML = `<input id="name" name="old">`;
    const issue = vi.fn();
    const b = bridge(
      { name: { element: el<HTMLInputElement>('name'), label: 'Name' } },
      {},
      { onIssue: issue },
    );
    el<HTMLInputElement>('name').name = 'new';
    expect(b.setValue('name', 'Blocked')).toBe(false);
    expect(issue).toHaveBeenCalledWith('changed-control');
    el('name').remove();
    expect(b.setValue('name', 'Blocked')).toBe(false);
    expect(issue).toHaveBeenCalledWith('disconnected');
  });
  it('fails closed when the submit button form changes its destination', () => {
    document.body.innerHTML = `<form id="form" action="/official"><button id="go">Go</button></form>`;
    const issue = vi.fn();
    const submitted = vi.fn((event: Event) => event.preventDefault());
    el('form').addEventListener('submit', submitted);
    const b = bridge({}, { go: { element: el('go'), label: 'Go' } }, { onIssue: issue });
    el('form').setAttribute('action', 'https://evil.example/');
    expect(b.activate('go')).toBe(false);
    expect(issue).toHaveBeenCalledWith('changed-control');
    expect(submitted).not.toHaveBeenCalled();
  });
  it('uses exact unambiguous labels, without guessing field positions', () => {
    document.body.innerHTML = `<label for="doc">Número de Documento:</label><input id="doc"><input id="letter" aria-label="Letra">`;
    expect(fieldByLabel(document, 'Numero de Documento')).toBe(el('doc'));
    expect(fieldByLabel(document, 'Número')).toBeNull();
    document.body.insertAdjacentHTML('beforeend', '<input aria-label="Letra">');
    expect(fieldByLabel(document, 'Letra')).toBeNull();
  });
  it('retains stable snapshots and releases data and observers on disposal', () => {
    document.body.innerHTML = '<input id="name">';
    const b = bridge({ name: { element: el<HTMLInputElement>('name'), label: 'Name' } });
    const first = b.getField('name');
    b.refresh();
    expect(b.getField('name')).toBe(first);
    b.dispose();
    expect(b.setValue('name', 'No')).toBe(false);
    expect(() => b.getField('name')).toThrow();
  });
});

it('applies the official length limits that script-written values skip', () => {
  document.body.innerHTML =
    '<form id="f"><input id="q" name="q" minlength="2" maxlength="5"><button id="go">Buscar</button></form>';
  const input = document.querySelector<HTMLInputElement>('#q')!;
  const form = document.querySelector<HTMLFormElement>('#f')!;
  const submitted = vi.fn((event: Event) => event.preventDefault());
  form.addEventListener('submit', submitted);
  const bridge = new DomBridge(
    { q: { element: input, label: 'Búsqueda' } },
    { go: { element: document.querySelector<HTMLButtonElement>('#go')!, label: 'Buscar' } },
  );
  bridge.setValue('q', 'v');
  bridge.activate('go');
  expect(submitted).not.toHaveBeenCalled();
  expect(bridge.getInvalid()).toBe('q');
  bridge.setValue('q', 'vecinos');
  bridge.activate('go');
  expect(submitted).not.toHaveBeenCalled(); // 7 > maxlength 5
  bridge.setValue('q', 'veci');
  bridge.activate('go');
  expect(submitted).toHaveBeenCalledOnce();
  expect(bridge.getInvalid()).toBeNull();
  bridge.dispose();
});

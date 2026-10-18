/** DOM-only bridge. Never owns a network request, a session or a saved field value. */
export type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export type ActionElement = HTMLButtonElement | HTMLInputElement | HTMLAnchorElement | HTMLElement;
export interface FieldSpec {
  element: FieldElement;
  label: string;
  help?: string;
}
export interface ActionSpec {
  element: ActionElement;
  label: string;
  /**
   * The official page uses a non-native clickable element (e.g. a div with an onclick handler).
   * Only declare it after reviewing that element: activation is a plain click() on it.
   */
  custom?: boolean;
}
export interface FieldSnapshot {
  value: string;
  checked: boolean;
  values: readonly string[];
  type: string;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  multiple: boolean;
  maxLength: number;
  minLength: number;
  pattern: string;
  min: string;
  max: string;
  step: string;
  inputMode: string;
  autocomplete: string;
  placeholder: string;
  invalid: boolean;
  validationMessage: string;
  connected: boolean;
  options: readonly { value: string; label: string; disabled: boolean; group: string | null }[];
}
export type BridgeIssue =
  'disconnected' | 'unsupported-control' | 'changed-control' | 'missing-binding';
export interface BridgeOptions {
  onIssue?: (issue: BridgeIssue) => void;
  pollMs?: number;
}

const textTypes = new Set(['text', 'email', 'tel', 'url', 'search']);
function violatesLength(element: FieldElement): boolean {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement))
    return false;
  const length = element.value.length;
  if (length === 0) return false; // "required" is still checked natively by the browser
  return (
    (element.minLength > 0 && length < element.minLength) ||
    (element.maxLength >= 0 && length > element.maxLength)
  );
}

export function isBindableField(element: Element): element is FieldElement {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  return (
    element instanceof HTMLInputElement &&
    (textTypes.has(element.type) || ['checkbox', 'radio'].includes(element.type))
  );
}

function snapshot(element: FieldElement): FieldSnapshot {
  const input = element instanceof HTMLInputElement ? element : null;
  const text =
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : null;
  const select = element instanceof HTMLSelectElement ? element : null;
  return {
    value: element.value,
    checked: input?.checked ?? false,
    values: select ? Array.from(select.selectedOptions, (o) => o.value) : [],
    type: input?.type ?? (select ? 'select' : 'textarea'),
    disabled: element.matches(':disabled'),
    readOnly: text?.readOnly ?? false,
    required: element.required,
    multiple: select?.multiple ?? false,
    maxLength: text?.maxLength ?? -1,
    minLength: text?.minLength ?? -1,
    pattern: input?.pattern ?? '',
    min: input?.min ?? '',
    max: input?.max ?? '',
    step: input?.step ?? '',
    inputMode: element.inputMode,
    autocomplete: element.autocomplete,
    placeholder: text?.placeholder ?? '',
    invalid: !element.validity.valid,
    validationMessage: element.validationMessage,
    connected: element.isConnected,
    options: select
      ? Array.from(select.options, (o) => ({
          value: o.value,
          label: o.label,
          disabled:
            o.disabled ||
            (o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled),
          group: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : null,
        }))
      : [],
  };
}

export class DomBridge {
  private fields = new Map<string, FieldSpec>();
  private actions = new Map<string, ActionSpec>();
  private snapshots = new Map<string, FieldSnapshot>();
  private signatures = new Map<string, string>();
  private shapes = new Map<string, { type: string; name: string; form: HTMLFormElement | null }>();
  private actionShapes = new Map<string, string>();
  private listeners = new Set<() => void>();
  private observer: MutationObserver;
  private timer: ReturnType<typeof setInterval>;
  private disposed = false;
  private invalid: string | null = null;
  private revision = 0;
  private doc: Document;

  constructor(
    fields: Record<string, FieldSpec>,
    actions: Record<string, ActionSpec> = {},
    private options: BridgeOptions = {},
  ) {
    this.doc =
      Object.values(fields)[0]?.element.ownerDocument ??
      Object.values(actions)[0]?.element.ownerDocument ??
      document;
    const elements = new Set<Element>();
    for (const [id, spec] of Object.entries(fields)) {
      if (!isBindableField(spec.element) || elements.has(spec.element))
        throw new Error('Unsupported or duplicate field binding');
      if (!spec.element.isConnected) throw new Error('Cannot bind a detached control');
      this.fields.set(id, spec);
      elements.add(spec.element);
      this.shapes.set(id, {
        type: spec.element.type,
        name: spec.element.name,
        form: spec.element.form,
      });
    }
    for (const [id, spec] of Object.entries(actions)) {
      if (!isBindableAction(spec.element, spec.custom === true))
        throw new Error('Unsupported action binding');
      if (!spec.element.isConnected) throw new Error('Cannot bind a detached control');
      this.actions.set(id, spec);
      this.actionShapes.set(id, this.actionShape(spec.element));
    }
    this.refresh();
    for (const name of ['input', 'change', 'reset', 'focusin', 'focusout'])
      this.doc.addEventListener(name, this.onEvent, true);
    this.doc.addEventListener('submit', this.onSubmit, true);
    this.observer = new MutationObserver(this.refresh);
    this.observer.observe(this.doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    // Property assignments and autofill need sampling; they do not always emit events or mutations.
    this.timer = setInterval(this.refresh, options.pollMs ?? 150);
  }

  private onEvent = () => {
    this.refresh();
    queueMicrotask(this.refresh);
  };
  private issue(issue: BridgeIssue): false {
    this.options.onIssue?.(issue);
    return false;
  }
  private actionShape(element: ActionElement): string {
    // A submit button's destination is its formaction or, by default, its form's action.
    const form =
      element instanceof HTMLButtonElement || element instanceof HTMLInputElement
        ? element.form
        : null;
    return JSON.stringify([
      form?.getAttribute('action'),
      element.tagName,
      element.getAttribute('type'),
      element.getAttribute('href'),
      element.getAttribute('name'),
      element.getAttribute('value'),
      element.getAttribute('formaction'),
      element.getAttribute('onclick'),
    ]);
  }
  private valid(id: string, element: FieldElement): boolean {
    const shape = this.shapes.get(id);
    if (!element.isConnected) return this.issue('disconnected');
    if (!isBindableField(element)) return this.issue('unsupported-control');
    if (
      !shape ||
      shape.type !== element.type ||
      shape.name !== element.name ||
      shape.form !== element.form
    )
      return this.issue('changed-control');
    return true;
  }
  refresh = (): void => {
    if (this.disposed) return;
    let changed = false;
    for (const [id, { element }] of this.fields) {
      if (!this.valid(id, element)) return;
      const next = snapshot(element);
      const signature = JSON.stringify(next);
      if (signature !== this.signatures.get(id)) {
        this.snapshots.set(id, next);
        this.signatures.set(id, signature);
        changed = true;
      }
    }
    for (const [id, { element }] of this.actions) {
      if (!element.isConnected) {
        this.issue('disconnected');
        return;
      }
      if (this.actionShapes.get(id) !== this.actionShape(element)) {
        this.issue('changed-control');
        return;
      }
      const signature = JSON.stringify([
        element.matches(':disabled'),
        element.getAttribute('aria-disabled'),
      ]);
      if (this.signatures.get(`action:${id}`) !== signature) {
        this.signatures.set(`action:${id}`, signature);
        changed = true;
      }
    }
    if (changed) {
      this.revision++;
      this.listeners.forEach((listener) => listener());
    }
  };
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getRevision = (): number => this.revision;
  /** Binding whose value broke an official length constraint on the last submit attempt. */
  getInvalid = (): string | null => this.invalid;
  /**
   * Values written by script skip the browser's minlength/maxlength checks (they only apply to
   * user edits). Before an official form with connected fields is submitted, the same limits
   * declared on the original controls are checked; if one fails, the submission is stopped and
   * the connected field reports it.
   */
  private onSubmit = (event: Event) => {
    if (this.disposed || !(event.target instanceof HTMLFormElement)) return;
    for (const [id, { element }] of this.fields) {
      if (element.form !== event.target || !violatesLength(element)) continue;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.invalid = id;
      this.revision++;
      this.listeners.forEach((listener) => listener());
      return;
    }
  };
  getField(id: string): FieldSnapshot {
    const result = this.snapshots.get(id);
    if (!result) throw new Error('Unknown field binding');
    return result;
  }
  fieldSpec(id: string): FieldSpec {
    const spec = this.fields.get(id);
    if (!spec) throw new Error('Unknown field binding');
    return spec;
  }
  actionSpec(id: string): ActionSpec {
    const spec = this.actions.get(id);
    if (!spec) throw new Error('Unknown action binding');
    return spec;
  }

  setValue(id: string, value: string | readonly string[]): boolean {
    if (this.disposed) return false;
    const element = this.fields.get(id)?.element;
    if (!element) return this.issue('missing-binding');
    if (
      !this.valid(id, element) ||
      element.matches(':disabled') ||
      ('readOnly' in element && element.readOnly)
    )
      return false;
    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type))
      return false;
    if (element instanceof HTMLSelectElement) {
      const values = typeof value === 'string' ? [value] : [...value];
      if (!element.multiple && values.length !== 1) return false;
      const options = snapshot(element).options;
      if (values.some((v) => !options.some((o) => o.value === v && !o.disabled))) return false;
      for (const option of element.options) option.selected = values.includes(option.value);
    } else {
      if (typeof value !== 'string') return false;
      const prototype =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      // Bypass framework-owned instance setters so the original input listener sees the change.
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    if (this.invalid === id) this.invalid = null;
    this.refresh();
    return true;
  }
  setChecked(id: string, checked: boolean): boolean {
    if (this.disposed) return false;
    const element = this.fields.get(id)?.element;
    if (
      !(element instanceof HTMLInputElement) ||
      !this.valid(id, element) ||
      !['checkbox', 'radio'].includes(element.type) ||
      element.matches(':disabled')
    )
      return false;
    if (element.type === 'radio' && !checked) return false;
    if (element.checked !== checked) element.click(); // Preserves radio grouping and click cancellation.
    this.refresh();
    return element.checked === checked;
  }
  activate(id: string): boolean {
    if (this.disposed) return false;
    const element = this.actions.get(id)?.element;
    if (!element) return this.issue('missing-binding');
    if (!element.isConnected) return this.issue('disconnected');
    if (this.actionShapes.get(id) !== this.actionShape(element))
      return this.issue('changed-control');
    if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true')
      return false;
    element.click(); // Original listeners, submitter name/value, validation and navigation stay in charge.
    this.refresh();
    return true;
  }
  /** Browser-like implicit submission from a text field. Uses the original default submitter. */
  submitFromField(id: string): boolean {
    if (this.disposed) return false;
    const source = this.fields.get(id)?.element;
    if (!source || !this.valid(id, source) || source.matches(':disabled')) return false;
    const form = source.form;
    if (!form) return false;
    const controls = Array.from(this.doc.querySelectorAll('button,input')).filter(
      (element): element is HTMLButtonElement | HTMLInputElement =>
        (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) &&
        element.form === form,
    );
    const submitter = controls.find(
      (element) => element.type === 'submit' || element.type === 'image',
    );
    if (submitter) {
      if (submitter.matches(':disabled')) return false;
      submitter.click();
      return true;
    }
    const blocking = controls.filter(
      (element) =>
        element instanceof HTMLInputElement &&
        [
          'text',
          'search',
          'url',
          'tel',
          'email',
          'password',
          'date',
          'month',
          'week',
          'time',
          'datetime-local',
          'number',
        ].includes(element.type),
    );
    if (blocking.length > 1) return false;
    form.requestSubmit();
    return true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.timer);
    this.observer.disconnect();
    for (const name of ['input', 'change', 'reset', 'focusin', 'focusout'])
      this.doc.removeEventListener(name, this.onEvent, true);
    this.doc.removeEventListener('submit', this.onSubmit, true);
    this.listeners.clear();
    this.snapshots.clear();
    this.signatures.clear();
    this.fields.clear();
    this.actions.clear();
    this.shapes.clear();
    this.actionShapes.clear();
  }
}

/** Native actions are always bindable; any other element only when explicitly declared `custom`. */
export function isBindableAction(element: Element, custom = false): element is ActionElement {
  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLAnchorElement ||
    (element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type))
  )
    return true;
  return custom && element instanceof HTMLElement;
}

export function uniqueElement<T extends Element>(
  root: ParentNode,
  selector: string,
  guard: (element: Element) => element is T,
): T | null {
  const matches = root.querySelectorAll(selector);
  const match = matches.item(0);
  return matches.length === 1 && match && guard(match) ? match : null;
}

export function normalizedLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[\s:*]+/g, ' ')
    .trim();
}

/** Exact accessible-label matching. Never guesses by field order, current values or fuzzy text. */
export function fieldByLabel(root: ParentNode, label: string): FieldElement | null {
  const matches = Array.from(root.querySelectorAll('input, select, textarea'))
    .filter(isBindableField)
    .filter((element) => {
      const names = [
        element.getAttribute('aria-label') ?? '',
        ...Array.from(element.labels ?? [], (l) => l.textContent ?? ''),
      ];
      const labelledBy = element
        .getAttribute('aria-labelledby')
        ?.split(/\s+/)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
        .join(' ');
      if (labelledBy) names.push(labelledBy);
      return names.some((name) => normalizedLabel(name) === normalizedLabel(label));
    });
  return matches.length === 1 ? matches[0]! : null;
}

/** The link's URL if it is HTTPS on `host` or one of its subdomains; otherwise null. */
export function officialHref(link: HTMLAnchorElement, host: string): string | null {
  let url: URL;
  try {
    url = new URL(link.href);
  } catch {
    return null;
  }
  const onHost = url.hostname === host || url.hostname.endsWith(`.${host}`);
  return url.protocol === 'https:' && !url.username && !url.password && onHost ? url.href : null;
}

/** Visible text with collapsed whitespace. */
export function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Resolves every required selector exactly once. Returns null if any is missing or ambiguous,
 * so `prepare` can keep the original page (same rule as `uniqueElement`).
 */
export function requireElements<K extends string>(
  root: ParentNode,
  selectors: Record<K, string>,
): Record<K, HTMLElement> | null {
  const found = {} as Record<K, HTMLElement>;
  for (const key of Object.keys(selectors) as K[]) {
    const matches = root.querySelectorAll(selectors[key]);
    const match = matches.item(0);
    if (matches.length !== 1 || !(match instanceof HTMLElement)) return null;
    found[key] = match;
  }
  return found;
}

/** Brings an official section into view and highlights it briefly. Never changes its content. */
export function scrollToOfficial(element: Element | null): void {
  if (!(element instanceof HTMLElement)) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const hadTabIndex = element.hasAttribute('tabindex');
  if (!hadTabIndex) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  const { outline, outlineOffset } = element.style;
  element.style.outline = '3px solid #1f57bf';
  element.style.outlineOffset = '4px';
  setTimeout(() => {
    element.style.outline = outline;
    element.style.outlineOffset = outlineOffset;
    if (!hadTabIndex) element.removeAttribute('tabindex');
  }, 2500);
}

/** Whether an official element is rendered (not display:none / visibility:hidden). */
export function isVisible(element: Element | null): boolean {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  return element.offsetParent !== null || style?.position === 'fixed';
}

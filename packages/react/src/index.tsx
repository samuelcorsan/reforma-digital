import { Input } from '@reforma-digital/design/ui/input';
import { Textarea } from '@reforma-digital/design/ui/textarea';
import { Button } from '@reforma-digital/design/ui/button';
import { Checkbox } from '@reforma-digital/design/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@reforma-digital/design/ui/radio-group';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@reforma-digital/design/ui/select';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
} from 'react';
import { DomBridge, type FieldSnapshot } from '@reforma-digital/bridge';

const BridgeContext = createContext<DomBridge | null>(null);
export const BridgeProvider = BridgeContext.Provider;
export function useBridge(): DomBridge {
  const bridge = useContext(BridgeContext);
  if (!bridge) throw new Error('Wrap connected components in BridgeProvider');
  return bridge;
}
export function useBoundField(binding: string): FieldSnapshot {
  const bridge = useBridge();
  return useSyncExternalStore(bridge.subscribe, () => bridge.getField(binding));
}

/** Native date pickers, file inputs, CAPTCHA, certificates and signature controls stay on the page. */
export function BoundField({
  binding,
  className = '',
  submitAction,
}: {
  binding: string;
  className?: string;
  submitAction?: string;
}) {
  const bridge = useBridge();
  const state = useBoundField(binding);
  const spec = bridge.fieldSpec(binding);
  const id = useId();
  // When the bridge stops an official submit because of this field, show the browser's message here.
  const invalid = useSyncExternalStore(bridge.subscribe, () => bridge.getInvalid() === binding);
  const control = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (invalid) control.current?.reportValidity();
  }, [invalid]);
  const checkable = state.type === 'checkbox' || state.type === 'radio';
  const common = {
    id,
    disabled: state.disabled,
    required: state.required,
    'aria-describedby': spec.help ? `${id}-help` : undefined,
    'aria-invalid': spec.element.getAttribute('aria-invalid') === 'true' ? true : undefined,
    className: 'min-h-12',
  };
  return (
    <div
      className={`bg-bound block [min-width:0] [padding:6px_0_12px] ${className}`.trim()}
      data-binding={binding}
    >
      {!checkable ? (
        <label
          id={`${id}-label`}
          className={'block text-15 leading-1.4 font-semibold text-ink [margin-bottom:6px]'}
          htmlFor={id}
        >
          {spec.label}
          {state.required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {state.type === 'select' ? (
        <Select<string, boolean>
          multiple={state.multiple}
          value={state.multiple ? [...state.values] : state.value}
          items={state.options}
          disabled={state.disabled}
          required={state.required}
          onValueChange={(value) => {
            if (value !== null) bridge.setValue(binding, value);
          }}
        >
          <SelectTrigger
            id={id}
            aria-labelledby={`${id}-label`}
            aria-describedby={common['aria-describedby']}
            aria-invalid={common['aria-invalid']}
            className={'w-full'}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {state.options.map((option, index) => (
              <SelectItem
                key={`${option.value}-${index}`}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : state.type === 'textarea' ? (
        <Textarea
          {...common}
          ref={control}
          value={state.value}
          readOnly={state.readOnly}
          maxLength={state.maxLength < 0 ? undefined : state.maxLength}
          placeholder={state.placeholder}
          onChange={(event) => bridge.setValue(binding, event.currentTarget.value)}
        />
      ) : checkable ? (
        <label className="flex min-h-11 items-center gap-2" htmlFor={id}>
          {state.type === 'checkbox' ? (
            <Checkbox
              id={id}
              disabled={state.disabled}
              required={state.required}
              aria-describedby={common['aria-describedby']}
              aria-invalid={common['aria-invalid']}
              checked={state.checked}
              onCheckedChange={(checked) => bridge.setChecked(binding, checked)}
            />
          ) : (
            <RadioGroup
              value={state.checked ? 'selected' : ''}
              onValueChange={() => bridge.setChecked(binding, true)}
            >
              <RadioGroupItem
                id={id}
                value="selected"
                disabled={state.disabled}
                required={state.required}
                aria-label={spec.label}
              />
            </RadioGroup>
          )}
          {spec.label}
        </label>
      ) : (
        <Input
          {...common}
          ref={control}
          type={state.type}
          value={state.value}
          readOnly={state.readOnly}
          maxLength={state.maxLength < 0 ? undefined : state.maxLength}
          minLength={state.minLength < 0 ? undefined : state.minLength}
          pattern={state.pattern || undefined}
          autoComplete={state.autocomplete || 'off'}
          placeholder={state.placeholder}
          inputMode={state.inputMode as 'text'}
          onChange={(event) => bridge.setValue(binding, event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (submitAction) bridge.activate(submitAction);
              else bridge.submitFromField(binding);
            }
          }}
        />
      )}
      {spec.help ? (
        <p id={`${id}-help`} className={'text-sm leading-normal text-ink-muted mt-1.5'}>
          {spec.help}
        </p>
      ) : null}
    </div>
  );
}

export function BoundButton({
  binding,
  children,
  ...props
}: { binding: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'>) {
  const bridge = useBridge();
  useSyncExternalStore(bridge.subscribe, bridge.getRevision);
  const spec = bridge.actionSpec(binding);
  return (
    <Button
      {...props}
      type="button"
      disabled={
        props.disabled ||
        spec.element.matches(':disabled') ||
        spec.element.getAttribute('aria-disabled') === 'true'
      }
      onClick={() => bridge.activate(binding)}
    >
      {children ?? spec.label}
    </Button>
  );
}

/**
 * Reads a value derived from official content that is not a bound control (messages loaded by
 * AJAX, validation text…) and keeps it up to date when that content changes.
 */
export function useDomValue<T>(root: Node | null, read: () => T): T {
  const readRef = useRef(read);
  readRef.current = read;
  const [value, setValue] = useState<T>(() => read());
  useEffect(() => {
    if (!root) return;
    let last = JSON.stringify(readRef.current());
    const update = () => {
      const next = readRef.current();
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setValue(next);
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [root]);
  return value;
}

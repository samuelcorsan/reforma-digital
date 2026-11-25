import { codeToTokens, type BundledLanguage } from 'shiki';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { CopyButton } from './copy-button';

export type Sample = { label: string; lang: BundledLanguage | 'text'; code: string };

const frame = 'my-4 overflow-hidden rounded-2xl bg-foreground text-background';
const bar =
  'border-b border-background/15 px-4 font-mono text-xs uppercase tracking-wider text-background/70';

// Se resalta en el servidor: el navegador recibe HTML coloreado sin cargar Shiki.
async function Code({ label, lang, code }: Sample) {
  const { tokens } = await codeToTokens(code, { lang, theme: 'vitesse-dark' });
  return (
    <div className="flex items-start">
      <pre className="min-w-0 flex-1 overflow-x-auto p-4 font-mono text-13 leading-relaxed">
        <code>
          {tokens.map((line, i) => (
            <span key={i}>
              {i > 0 && '\n'}
              {line.map((token, j) => (
                <span key={j} className="text-(--color)" style={{ '--color': token.color }}>
                  {token.content}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
      <CopyButton label={label} code={code} />
    </div>
  );
}

export function CodeBlock({ samples }: { samples: Sample[] }) {
  const [first] = samples;
  if (samples.length === 1 && first)
    return (
      <figure className={frame}>
        <figcaption className={`${bar} py-3`}>{first.label}</figcaption>
        <Code {...first} />
      </figure>
    );
  return (
    <Tabs defaultValue={first?.label} className={`${frame} gap-0`}>
      <TabsList variant="line" className={`${bar} h-auto w-full justify-start gap-4 py-0`}>
        {samples.map(({ label }) => (
          <TabsTrigger
            key={label}
            value={label}
            className="flex-none px-0 py-3 text-xs text-background/60 after:bg-background hover:text-background data-active:text-background"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {samples.map((sample) => (
        <TabsContent key={sample.label} value={sample.label}>
          <Code {...sample} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

import type { ReactNode } from 'react';

/**
 * El Markdown mínimo de los textos de /developers (lib/developers/api.ts y las descripciones de
 * los servidores MCP): `código` y **énfasis**. Lo demás va tal cual.
 */
export function Texto({ text }: { text: string }): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} className="font-mono text-em-90">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={i} className="text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    return part;
  });
}

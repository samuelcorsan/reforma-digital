import { read } from '../../lib/congreso/data';
import { balanceSchema, legislatureSchema } from '../../lib/congreso/schema';
import { href } from '../congreso/common';
import { Figures } from './figures';
import { Cell, Grid, ReportIntro, Heading } from './report';
import { thousands } from '../../lib/elecciones/format';
import { electionPages } from '../../lib/elecciones/pages';

// «La legislatura en cifras»: cada día de la legislatura y por cuántos votos se decidió cada
// votación. Estructura de Escaño Abierto.
export async function LegislatureFigures() {
  const [source, legislature] = await Promise.all([
    read('elecciones/elecciones.json', balanceSchema),
    read('elecciones/legislatura.json', legislatureSchema),
  ]);
  const b = source.balance;
  const days =
    Math.round(
      (Date.parse(`${legislature.hasta}T00:00:00Z`) -
        Date.parse(`${legislature.desde}T00:00:00Z`)) /
        864e5,
    ) + 1;
  return (
    <>
      <ReportIntro title={electionPages.legislatura.title}>
        <p>
          Actividad de la XV legislatura desde la sesión constitutiva hasta la disolución:
          votaciones, leyes, decretos-leyes y preguntas.
        </p>
      </ReportIntro>
      <Grid>
        <Cell>
          <Figures
            from={legislature.desde}
            to={legislature.hasta}
            days={legislature.dias}
            votes={legislature.votos}
            plenaries={b.plenos}
            unanswered={b.sin_respuesta}
            voteHref={href('votacion')}
            intro={{
              calendar: (
                <Heading title="Actividad diaria">
                  Los {thousands(days)} días entre la sesión constitutiva y la disolución.
                </Heading>
              ),
              margins: <Heading title="Márgenes de votación" />,
            }}
          />
        </Cell>
      </Grid>
    </>
  );
}

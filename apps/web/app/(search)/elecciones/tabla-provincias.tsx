'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Field } from '@reforma-digital/design/sol';
import { Icon } from '../../../components/sol/icon';

type Fila = {
  href: string;
  name: string;
  seats: number;
  seats2023: number;
  population: number;
  perSeat: number;
};

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
// Sin tildes ni mayúsculas: «avila» encuentra «Ávila».
const normal = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
const ordenes = [
  {
    valor: 'nombre',
    texto: 'Nombre',
    cmp: (a: Fila, b: Fila) => a.name.localeCompare(b.name, 'es'),
  },
  {
    valor: 'escanos',
    texto: 'Escaños',
    cmp: (a: Fila, b: Fila) => b.seats - a.seats || b.population - a.population,
  },
] as const;

function cambio(diferencia: number) {
  return diferencia === 0 ? '=' : diferencia > 0 ? `+${diferencia}` : `−${-diferencia}`;
}

export function TablaProvincias({ items }: { items: Fila[] }) {
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<(typeof ordenes)[number]>(ordenes[0]);
  // Cada palabra debe aparecer en el nombre: «cruz tenerife» encuentra «Santa Cruz de Tenerife».
  const palabras = normal(busqueda).split(/\s+/).filter(Boolean);
  const visibles = items
    .filter((p) => palabras.every((palabra) => normal(p.name).includes(palabra)))
    .sort(orden.cmp);

  return (
    <>
      <div className="el-controles">
        <div className="el-control el-control-buscar">
          <label htmlFor="el-buscar">Buscar tu provincia</label>
          <span className="el-con-icono">
            <Icon name="buscar" size={16} />
            <Field
              id="el-buscar"
              type="search"
              placeholder="Por ejemplo, Ávila"
              autoComplete="off"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </span>
        </div>
        <div className="el-control">
          <label htmlFor="el-orden">Ordenar por</label>
          <span className="el-desplegable">
            <select
              id="el-orden"
              className="campo"
              value={orden.valor}
              onChange={(e) =>
                setOrden(ordenes.find((o) => o.valor === e.target.value) ?? ordenes[0])
              }
            >
              {ordenes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
            <Icon name="abajo" size={16} />
          </span>
        </div>
      </div>
      <p className="el-recuento" role="status">
        {busqueda &&
          (visibles.length
            ? `${visibles.length} de ${items.length} circunscripciones`
            : `Ninguna circunscripción coincide con «${busqueda}».`)}
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Circunscripción</th>
              <th scope="col">Escaños</th>
              <th scope="col">Frente a 2023</th>
              <th scope="col">Habitantes por escaño</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.href}>
                <th scope="row">
                  <Link className="enlace" href={p.href}>
                    {p.name}
                  </Link>
                </th>
                <td>{p.seats}</td>
                <td>{cambio(p.seats - p.seats2023)}</td>
                <td>{numero.format(p.perSeat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

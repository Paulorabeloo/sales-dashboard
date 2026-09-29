import type { Ciclo } from '@/types/domain';

/*
 * T-108 — Tabela de ciclos acadêmicos.
 *
 * ADR-006: ciclos vivem em código (não em DB nem env var). Para adicionar
 * um novo ciclo, edite o array abaixo e faça push em git.
 *
 * Janelas inferidas a partir de dados históricos no PDF do BI atual.
 * Usuário deve confirmar/ajustar quando o normalizer entrar em produção.
 */
export const CICLOS: ReadonlyArray<Ciclo> = [
  {
    id: '2024.1',
    inicio: new Date(2023, 9, 30), // 30/out/2023
    fim: new Date(2024, 4, 31, 23, 59, 59), // 31/mai/2024
    cicloAnteriorId: null,
  },
  {
    id: '2024.2',
    inicio: new Date(2024, 5, 1), // 01/jun/2024
    fim: new Date(2024, 11, 31, 23, 59, 59),
    cicloAnteriorId: '2024.1',
  },
  {
    id: '2025.1',
    inicio: new Date(2025, 0, 1),
    fim: new Date(2025, 4, 31, 23, 59, 59),
    cicloAnteriorId: '2024.1',
  },
  {
    id: '2025.2',
    inicio: new Date(2025, 5, 1),
    fim: new Date(2025, 11, 31, 23, 59, 59),
    cicloAnteriorId: '2024.2',
  },
  {
    id: '2026.1',
    inicio: new Date(2026, 0, 1),
    fim: new Date(2026, 4, 31, 23, 59, 59),
    cicloAnteriorId: '2025.1',
  },
];

export function getCicloPorData(
  data: Date,
  ciclos: ReadonlyArray<Ciclo> = CICLOS,
): Ciclo | null {
  const t = data.getTime();
  return (
    ciclos.find((c) => c.inicio.getTime() <= t && t <= c.fim.getTime()) ?? null
  );
}

export function getCicloAtivo(
  now: Date = new Date(),
  ciclos: ReadonlyArray<Ciclo> = CICLOS,
): Ciclo | null {
  return getCicloPorData(now, ciclos);
}

export function getCiclo(
  id: string,
  ciclos: ReadonlyArray<Ciclo> = CICLOS,
): Ciclo | null {
  return ciclos.find((c) => c.id === id) ?? null;
}

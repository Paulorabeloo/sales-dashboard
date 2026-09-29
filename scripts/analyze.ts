/*
 * scripts/analyze.ts — análise exploratória dos dados reais.
 *
 * Usa o pipeline normal do repository pra carregar as matrículas e
 * roda 6 análises:
 *   1. Cohort por ciclo (matrículas acumuladas dia-a-dia)
 *   2. Top performers e concentração (Pareto)
 *   3. Anomalias por polo (z-score)
 *   4. Anomalias por vendedora
 *   5. Padrões por dia da semana
 *   6. Efetividade de origem e bolsa
 *
 * Saída: docs/analysis-data.json + docs/analysis-report.md
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { fetchRawSheet, makeSheetsClient } from '@/lib/sheets/adapter';
import { normalize } from '@/lib/sheets/normalizer';
import { CICLOS } from '@/lib/cycles';
import type { Matricula } from '@/types/domain';

const DAY_MS = 24 * 60 * 60 * 1000;

interface CycleCohort {
  cicloId: string;
  diasNoCiclo: number;
  totalCiclo: number;
  pontosAcumulados: Array<{ diaOffset: number; data: string; valor: number; acumulado: number }>;
}

function dayOffset(date: Date, refStart: Date): number {
  return Math.floor((date.getTime() - refStart.getTime()) / DAY_MS);
}

function cohortByCycle(matriculas: ReadonlyArray<Matricula>): CycleCohort[] {
  return CICLOS.map((ciclo) => {
    const inWindow = matriculas
      .filter(
        (m) =>
          m.dataMatricula.getTime() >= ciclo.inicio.getTime() &&
          m.dataMatricula.getTime() <= ciclo.fim.getTime(),
      )
      .sort((a, b) => a.dataMatricula.getTime() - b.dataMatricula.getTime());

    const totalDias = Math.floor(
      (ciclo.fim.getTime() - ciclo.inicio.getTime()) / DAY_MS,
    );

    // Bucketiza por dia offset
    const byDay = new Map<number, number>();
    for (const m of inWindow) {
      const off = dayOffset(m.dataMatricula, ciclo.inicio);
      byDay.set(off, (byDay.get(off) ?? 0) + 1);
    }

    const pontos: CycleCohort['pontosAcumulados'] = [];
    let acumulado = 0;
    for (let d = 0; d <= totalDias; d++) {
      const valor = byDay.get(d) ?? 0;
      acumulado += valor;
      const data = new Date(ciclo.inicio.getTime() + d * DAY_MS)
        .toISOString()
        .slice(0, 10);
      pontos.push({ diaOffset: d, data, valor, acumulado });
    }

    return {
      cicloId: ciclo.id,
      diasNoCiclo: totalDias,
      totalCiclo: inWindow.length,
      pontosAcumulados: pontos,
    };
  });
}

interface ParetoResult {
  totalMatriculas: number;
  totalVendedoras: number;
  top5Pct: number;
  top10Pct: number;
  top20Pct: number;
  rankingTop10: Array<{ nome: string; total: number; pct: number }>;
}

function paretoVendedoras(matriculas: ReadonlyArray<Matricula>): ParetoResult {
  const byVend = new Map<string, number>();
  const nomeMap = new Map<string, string>();
  for (const m of matriculas) {
    if (m.vendedoraId === 'desconhecido') continue;
    byVend.set(m.vendedoraId, (byVend.get(m.vendedoraId) ?? 0) + 1);
    nomeMap.set(m.vendedoraId, m.vendedoraNome || m.vendedoraId);
  }
  const sorted = Array.from(byVend.entries()).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  const take = (n: number) =>
    sorted.slice(0, n).reduce((s, [, v]) => s + v, 0);
  return {
    totalMatriculas: total,
    totalVendedoras: sorted.length,
    top5Pct: total === 0 ? 0 : (take(5) / total) * 100,
    top10Pct: total === 0 ? 0 : (take(10) / total) * 100,
    top20Pct: total === 0 ? 0 : (take(20) / total) * 100,
    rankingTop10: sorted.slice(0, 10).map(([id, n]) => ({
      nome: nomeMap.get(id) ?? id,
      total: n,
      pct: total === 0 ? 0 : (n / total) * 100,
    })),
  };
}

interface AnomalyResult {
  media: number;
  desvio: number;
  outliers: Array<{ nome: string; valor: number; zscore: number; tipo: 'alto' | 'baixo' }>;
}

function zscoreOutliers(
  pairs: Array<[string, number]>,
  threshold: number = 1.5,
): AnomalyResult {
  if (pairs.length === 0) return { media: 0, desvio: 0, outliers: [] };
  const values = pairs.map(([, v]) => v);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return { media: mean, desvio: 0, outliers: [] };
  const outliers = pairs
    .map(([k, v]) => ({
      nome: k,
      valor: v,
      zscore: (v - mean) / std,
      tipo: (v > mean ? 'alto' : 'baixo') as 'alto' | 'baixo',
    }))
    .filter((o) => Math.abs(o.zscore) >= threshold)
    .sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));
  return { media: mean, desvio: std, outliers };
}

function anomaliesPoloVolume(matriculas: ReadonlyArray<Matricula>): AnomalyResult {
  const byPolo = new Map<string, number>();
  for (const m of matriculas) byPolo.set(m.poloRaw || m.poloId, (byPolo.get(m.poloRaw || m.poloId) ?? 0) + 1);
  return zscoreOutliers(Array.from(byPolo.entries()));
}

function anomaliesVendedoraVolume(matriculas: ReadonlyArray<Matricula>): AnomalyResult {
  const byVend = new Map<string, number>();
  for (const m of matriculas) {
    if (m.vendedoraId === 'desconhecido') continue;
    byVend.set(m.vendedoraNome || m.vendedoraId, (byVend.get(m.vendedoraNome || m.vendedoraId) ?? 0) + 1);
  }
  return zscoreOutliers(Array.from(byVend.entries()));
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function diaSemanaAnalysis(matriculas: ReadonlyArray<Matricula>) {
  const counts = new Array(7).fill(0);
  for (const m of matriculas) counts[m.dataMatricula.getDay()]++;
  const total = counts.reduce((s, v) => s + v, 0);
  return counts.map((n, idx) => ({
    dia: DIAS_SEMANA[idx],
    total: n,
    pct: total === 0 ? 0 : (n / total) * 100,
  }));
}

function origemEficiencia(matriculas: ReadonlyArray<Matricula>) {
  const byOrigem = new Map<string, number>();
  for (const m of matriculas) byOrigem.set(m.origem, (byOrigem.get(m.origem) ?? 0) + 1);
  const total = matriculas.length;
  return Array.from(byOrigem.entries())
    .map(([origem, n]) => ({ origem, total: n, pct: total === 0 ? 0 : (n / total) * 100 }))
    .sort((a, b) => b.total - a.total);
}

function bolsaPopularidade(matriculas: ReadonlyArray<Matricula>) {
  const byBolsa = new Map<string, number>();
  for (const m of matriculas) {
    const k = m.bolsaConvenio ?? '— Não informado';
    byBolsa.set(k, (byBolsa.get(k) ?? 0) + 1);
  }
  const total = matriculas.length;
  return Array.from(byBolsa.entries())
    .map(([bolsa, n]) => ({ bolsa, total: n, pct: total === 0 ? 0 : (n / total) * 100 }))
    .sort((a, b) => b.total - a.total);
}

async function main() {
  const saKeyB64 = process.env.GOOGLE_SA_KEY ?? '';
  const sheetId = process.env.SHEETS_ID ?? '';
  const range = process.env.SHEETS_RANGE ?? '';

  // eslint-disable-next-line no-console
  console.log('Carregando dados via Sheets API...');
  const client = makeSheetsClient(saKeyB64);
  const { rows } = await fetchRawSheet(client, { sheetId, range });
  const result = normalize(rows);
  const data = { matriculas: result.matriculas, polos: result.polos, vendedoras: result.vendedoras };
  // eslint-disable-next-line no-console
  console.log(`${data.matriculas.length} matrículas carregadas.`);

  const cohorts = cohortByCycle(data.matriculas);
  const pareto = paretoVendedoras(data.matriculas);
  const anomaliasPolo = anomaliesPoloVolume(data.matriculas);
  const anomaliasVendedora = anomaliesVendedoraVolume(data.matriculas);
  const diaSemana = diaSemanaAnalysis(data.matriculas);
  const origens = origemEficiencia(data.matriculas);
  const bolsas = bolsaPopularidade(data.matriculas);

  const out = {
    geradoEm: new Date().toISOString(),
    totalMatriculas: data.matriculas.length,
    totalPolos: data.polos.length,
    totalVendedoras: data.vendedoras.length,
    cohortByCiclo: cohorts,
    paretoVendedoras: pareto,
    anomaliasPolo,
    anomaliasVendedora,
    diaSemana,
    origens,
    bolsas: bolsas.slice(0, 15),
  };

  const outDir = path.resolve(process.cwd(), 'docs');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'analysis-data.json'),
    JSON.stringify(out, null, 2),
    'utf-8',
  );

  // Markdown report
  const lines: string[] = [];
  lines.push('# Análise — Matrículas');
  lines.push('');
  lines.push(`_Gerado em ${new Date().toLocaleString('pt-BR')}_`);
  lines.push('');
  lines.push(`**Universo:** ${out.totalMatriculas.toLocaleString('pt-BR')} matrículas · ${out.totalPolos} polos · ${out.totalVendedoras} vendedoras`);
  lines.push('');

  // 1. Cohort
  lines.push('## 1. Cohort por ciclo (totais)');
  lines.push('');
  lines.push('| Ciclo | Total | Dias do ciclo |');
  lines.push('|---|---:|---:|');
  for (const c of cohorts) {
    lines.push(`| ${c.cicloId} | ${c.totalCiclo.toLocaleString('pt-BR')} | ${c.diasNoCiclo} |`);
  }
  lines.push('');

  // 2. Pareto
  lines.push('## 2. Concentração de performance (Pareto vendedoras)');
  lines.push('');
  lines.push(`**${pareto.totalVendedoras} vendedoras** somam ${pareto.totalMatriculas.toLocaleString('pt-BR')} matrículas.`);
  lines.push('');
  lines.push(`- Top 5 vendedoras → **${pareto.top5Pct.toFixed(1)}%** do total`);
  lines.push(`- Top 10 → **${pareto.top10Pct.toFixed(1)}%**`);
  lines.push(`- Top 20 → **${pareto.top20Pct.toFixed(1)}%**`);
  lines.push('');
  lines.push('### Top 10');
  lines.push('| # | Vendedora | Matrículas | % |');
  lines.push('|---|---|---:|---:|');
  pareto.rankingTop10.forEach((v, i) =>
    lines.push(`| ${i + 1} | ${v.nome} | ${v.total} | ${v.pct.toFixed(1)}% |`),
  );
  lines.push('');

  // 3. Polo outliers
  lines.push('## 3. Anomalias por polo (z-score ≥ 1.5)');
  lines.push('');
  lines.push(`Média: ${anomaliasPolo.media.toFixed(0)} matrículas/polo · Desvio: ${anomaliasPolo.desvio.toFixed(0)}`);
  lines.push('');
  if (anomaliasPolo.outliers.length === 0) {
    lines.push('_Nenhum outlier acima do threshold._');
  } else {
    lines.push('| Polo | Matrículas | Z-score | Tipo |');
    lines.push('|---|---:|---:|---|');
    for (const o of anomaliasPolo.outliers.slice(0, 10)) {
      lines.push(`| ${o.nome} | ${o.valor} | ${o.zscore.toFixed(2)} | ${o.tipo === 'alto' ? '🔥 fora da curva pra cima' : '🧊 abaixo do esperado'} |`);
    }
  }
  lines.push('');

  // 4. Vendedora outliers
  lines.push('## 4. Anomalias por vendedora (z-score ≥ 1.5)');
  lines.push('');
  lines.push(`Média: ${anomaliasVendedora.media.toFixed(0)} matrículas/vendedora · Desvio: ${anomaliasVendedora.desvio.toFixed(0)}`);
  lines.push('');
  if (anomaliasVendedora.outliers.length === 0) {
    lines.push('_Nenhum outlier._');
  } else {
    lines.push('| Vendedora | Matrículas | Z-score | Tipo |');
    lines.push('|---|---:|---:|---|');
    for (const o of anomaliasVendedora.outliers.slice(0, 10)) {
      lines.push(`| ${o.nome} | ${o.valor} | ${o.zscore.toFixed(2)} | ${o.tipo === 'alto' ? '🔥 acima' : '🧊 abaixo'} |`);
    }
  }
  lines.push('');

  // 5. Dia da semana
  lines.push('## 5. Padrão por dia da semana');
  lines.push('');
  lines.push('| Dia | Total | % |');
  lines.push('|---|---:|---:|');
  for (const d of diaSemana) lines.push(`| ${d.dia} | ${d.total.toLocaleString('pt-BR')} | ${d.pct.toFixed(1)}% |`);
  lines.push('');
  const melhorDia = [...diaSemana].sort((a, b) => b.total - a.total)[0];
  const piorDia = [...diaSemana].sort((a, b) => a.total - b.total)[0];
  lines.push(`**Insight:** ${melhorDia?.dia} é o melhor dia (${melhorDia?.pct.toFixed(1)}%), ${piorDia?.dia} é o pior (${piorDia?.pct.toFixed(1)}%).`);
  lines.push('');

  // 6. Origens
  lines.push('## 6. Origens das matrículas');
  lines.push('');
  lines.push('| Origem | Total | % |');
  lines.push('|---|---:|---:|');
  for (const o of origens) lines.push(`| ${o.origem} | ${o.total.toLocaleString('pt-BR')} | ${o.pct.toFixed(1)}% |`);
  lines.push('');

  // 7. Bolsas
  lines.push('## 7. Top 15 bolsas/convênios');
  lines.push('');
  lines.push('| Bolsa | Total | % |');
  lines.push('|---|---:|---:|');
  for (const b of bolsas.slice(0, 15))
    lines.push(`| ${b.bolsa} | ${b.total.toLocaleString('pt-BR')} | ${b.pct.toFixed(1)}% |`);
  lines.push('');

  // Sugestões
  lines.push('## Sugestões de novas visualizações no dashboard');
  lines.push('');
  lines.push('1. **Cohort curves**: linha por ciclo (dia offset × matrículas acumuladas) — vê na hora se 2026.1 está à frente/atrás dos anteriores no mesmo dia D.');
  lines.push('2. **Pareto chart das vendedoras** — barra ordenada + linha do acumulado, deixa óbvio quem carrega a operação.');
  lines.push('3. **Heatmap dia da semana × hora** — pra identificar janelas de venda (matrícula chega segunda à tarde? ou domingo de noite?).');
  lines.push('4. **Anomalias destacadas na tela /polos e /vendedoras** — bullet vermelho/verde sinalizando outliers.');
  lines.push('5. **Eficiência por origem segmentada por ciclo** — qual canal está crescendo mais em 2026.1 vs 2025.1.');
  lines.push('6. **Comparativo bolsa atual vs ciclo anterior** — quais convênios estão ganhando/perdendo terreno.');

  await writeFile(
    path.join(outDir, 'analysis-report.md'),
    lines.join('\n'),
    'utf-8',
  );

  // eslint-disable-next-line no-console
  console.log('\nRelatório gerado:');
  // eslint-disable-next-line no-console
  console.log(`  docs/analysis-data.json (${JSON.stringify(out).length} bytes)`);
  // eslint-disable-next-line no-console
  console.log(`  docs/analysis-report.md`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});

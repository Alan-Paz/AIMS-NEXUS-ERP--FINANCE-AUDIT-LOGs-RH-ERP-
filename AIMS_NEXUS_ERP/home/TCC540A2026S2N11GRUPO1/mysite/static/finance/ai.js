// AI analysis engine — connects to a real AI model via Puter.js
import { sheetToText, numericSummary } from './sheet.js';

const MODEL = 'gpt-5-nano';

const AUDIT_TYPES = {
  financeira: {
    label: 'Auditoria Financeira Geral',
    focus: 'consistência contábil, conciliação de saldos, lançamentos duplicados, valores atípicos (outliers), integridade de somatórios, fluxo de caixa e indicadores financeiros.'
  },
  fiscal: {
    label: 'Auditoria Fiscal / Tributária',
    focus: 'cálculo de tributos (ICMS, ISS, PIS, COFINS, IRPJ, CSLL), alíquotas aplicadas, base de cálculo, obrigações acessórias, notas fiscais e conformidade tributária.'
  },
  conformidade: {
    label: 'Conformidade ISO/IEC 42001',
    focus: 'governança do uso de IA, rastreabilidade, transparência, gestão de riscos do sistema de IA, controles e requisitos do Sistema de Gestão de IA (SGIA) da ISO/IEC 42001.'
  },
  fraude: {
    label: 'Detecção de Fraudes e Anomalias',
    focus: 'padrões suspeitos, transações fora do padrão, Lei de Benford, valores repetidos, quebras de segregação de funções e indícios de manipulação.'
  }
};

export function auditTypes() { return AUDIT_TYPES; }

function buildSystemPrompt() {
  return `Você é um auditor sênior especialista em auditoria financeira, fiscal e em conformidade com a norma ISO/IEC 42001 (Sistema de Gestão de Inteligência Artificial). 
Você analisa planilhas financeiras e fiscais de forma rigorosa, objetiva e profissional, sempre em português do Brasil.
Sua resposta DEVE ser em HTML simples (sem markdown, sem \`\`\`), usando apenas as tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <table>, <tr>, <th>, <td>.
NÃO inclua <html>, <head> ou <body>. Comece direto pelo conteúdo.`;
}

function buildUserPrompt(sheet, typeKey, extra) {
  const t = AUDIT_TYPES[typeKey] || AUDIT_TYPES.financeira;
  const num = numericSummary(sheet);
  const numTxt = num.numericCols.map(c =>
    `- ${c.name}: soma=${c.sum.toFixed(2)}, média=${c.avg.toFixed(2)}, mín=${c.min}, máx=${c.max}, itens=${c.count}`
  ).join('\n') || 'Nenhuma coluna numérica clara detectada.';

  return `Realize uma ${t.label}. Foco: ${t.focus}

DADOS DA PLANILHA "${sheet.name}":
${sheetToText(sheet)}

RESUMO NUMÉRICO PRÉ-CALCULADO:
${numTxt}
Linhas preenchidas: ${num.filledRows} | Colunas: ${num.totalCols}

${extra ? 'INSTRUÇÕES ADICIONAIS DO AUDITOR: ' + extra + '\n' : ''}
Produza um laudo de auditoria estruturado EXATAMENTE com estas seções em HTML:
<h2>1. Sumário Executivo</h2> (2-3 frases + veredito geral)
<h2>2. Pontuação de Conformidade</h2> (uma <table> com colunas Dimensão, Nota (0-100), Observação — inclua as dimensões: Integridade dos Dados, Consistência dos Cálculos, Conformidade Fiscal/Contábil, Governança ISO 42001, Risco de Fraude)
<h2>3. Achados e Não-Conformidades</h2> (lista <ul> com cada achado marcado com <strong>[CRÍTICO]</strong>, <strong>[ALTO]</strong>, <strong>[MÉDIO]</strong> ou <strong>[BAIXO]</strong>, citando a linha/valor específico quando possível)
<h2>4. Anomalias e Valores Atípicos</h2> (aponte números específicos suspeitos)
<h2>5. Recomendações</h2> (ações práticas e priorizadas)
<h2>6. Alinhamento ISO/IEC 42001</h2> (como o uso desta análise de IA atende requisitos de transparência, rastreabilidade e gestão de risco)

Ao final da primeira linha do Sumário Executivo, inclua a marcação: <p><strong>SCORE_GERAL: NN</strong></p> onde NN é a nota geral de 0 a 100.`;
}

export function extractScore(html) {
  const m = html && html.match(/SCORE_GERAL:\s*(\d{1,3})/i);
  if (m) return Math.min(100, parseInt(m[1], 10));
  return null;
}

export function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/```html/gi, '').replace(/```/g, '')
    .replace(/<p><strong>SCORE_GERAL:\s*\d{1,3}<\/strong><\/p>/gi, '')
    .replace(/SCORE_GERAL:\s*\d{1,3}/gi, '')
    .trim();
}

// Streaming analysis. onChunk(fullTextSoFar) called progressively.
export async function analyze(sheet, typeKey, extra, onChunk) {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(sheet, typeKey, extra) }
  ];
  let full = '';
  try {
    const resp = await puter.ai.chat(messages, { model: MODEL, stream: true });
    for await (const part of resp) {
      if (part && part.text) { full += part.text; if (onChunk) onChunk(full); }
    }
  } catch (e) {
    // Fallback: non-streaming
    const resp = await puter.ai.chat(messages, { model: MODEL });
    full = (resp && resp.message && resp.message.content) || (typeof resp === 'string' ? resp : '');
    if (onChunk) onChunk(full);
  }
  return full;
}

// Quick chat about a sheet (Assistant panel)
export async function askAbout(sheet, question, onChunk) {
  const messages = [
    { role: 'system', content: 'Você é um assistente de auditoria financeira e fiscal. Responda de forma objetiva em português do Brasil, em HTML simples (h3,p,ul,li,strong,table). Baseie-se estritamente nos dados fornecidos.' },
    { role: 'user', content: `Planilha "${sheet.name}":\n${sheetToText(sheet)}\n\nPergunta: ${question}` }
  ];
  let full = '';
  try {
    const resp = await puter.ai.chat(messages, { model: MODEL, stream: true });
    for await (const part of resp) { if (part && part.text) { full += part.text; if (onChunk) onChunk(full); } }
  } catch (e) {
    const resp = await puter.ai.chat(messages, { model: MODEL });
    full = (resp && resp.message && resp.message.content) || '';
    if (onChunk) onChunk(full);
  }
  return full;
}

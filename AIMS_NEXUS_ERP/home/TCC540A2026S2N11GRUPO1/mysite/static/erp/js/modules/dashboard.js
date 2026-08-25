import { state } from '../store.js';
import { BRL, NUM, sparkline, barChart, donut } from '../utils.js';
import { autoInsights, aiAvailable } from '../ai.js';

export function renderDashboard(view){
  const s = state;
  const valorEstoque = s.produtos.reduce((a,p)=> a + p.lotes.reduce((x,l)=>x+l.qtd*l.custo,0), 0);
  const unidades = s.produtos.reduce((a,p)=> a + p.lotes.reduce((x,l)=>x+l.qtd,0), 0);
  const receber = s.financeiro.receber.reduce((a,x)=> x.status!=='recebido'? a+x.valor:a, 0);
  const pagar = s.financeiro.pagar.reduce((a,x)=> x.status!=='pago'? a+x.valor:a, 0);
  const fat = s.financeiro.faturamento;
  const ult = fat.at(-1)||{receita:0,custo:0};
  const margem = ult.receita? ((ult.receita-ult.custo)/ult.receita*100):0;
  const insights = autoInsights();

  const kpis = [
    { label:'Faturamento (mês)', value:BRL(ult.receita), spark:fat.map(f=>f.receita), color:'#22d3ee', icon:'trending-up', sub:`Margem ${margem.toFixed(1)}%` },
    { label:'Valor em Estoque', value:BRL(valorEstoque), spark:[valorEstoque*.8,valorEstoque*.9,valorEstoque], color:'#a78bfa', icon:'boxes', sub:`${NUM(unidades)} unidades` },
    { label:'A Receber (aberto)', value:BRL(receber), spark:s.financeiro.receber.map(x=>x.valor), color:'#34d399', icon:'arrow-down-to-line', sub:`${s.financeiro.receber.filter(x=>x.status!=='recebido').length} títulos` },
    { label:'A Pagar (aberto)', value:BRL(pagar), spark:s.financeiro.pagar.map(x=>x.valor), color:'#fb7185', icon:'arrow-up-from-line', sub:`${s.financeiro.pagar.filter(x=>x.status!=='pago').length} títulos` }
  ];

  const modColor = ['#22d3ee','#a78bfa','#34d399','#fbbf24','#fb7185','#60a5fa'];
  const donutSegs = s.produtos.slice(0,6).map((p,i)=>({ label:p.nome, value:p.lotes.reduce((a,l)=>a+l.qtd*l.custo,0), color:modColor[i%modColor.length] }));

  view.innerHTML = `
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <div class="pill bg-brand-500/10 text-brand-300 border border-brand-500/20"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i> ${aiAvailable()?'Motor de IA ativo':'IA em modo offline'}</div>
      <div class="pill bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i> ISO/IEC 42001</div>
      <p class="text-sm text-slate-500">${s.empresa.fantasia} · ${s.empresa.regime}</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      ${kpis.map(k=>`
        <div class="card p-4">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs text-slate-500">${k.label}</p>
              <p class="text-xl font-bold text-white mt-1">${k.value}</p>
              <p class="text-[11px] text-slate-500 mt-0.5">${k.sub}</p>
            </div>
            <div class="w-9 h-9 rounded-lg bg-slate-800/60 flex items-center justify-center"><i data-lucide="${k.icon}" class="w-4 h-4" style="color:${k.color}"></i></div>
          </div>
          <div class="kpi-spark mt-2">${sparkline(k.spark,{color:k.color})}</div>
        </div>`).join('')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card p-5 lg:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-100">Receita × Custo (6 meses)</h3>
          <div class="flex items-center gap-3 text-[11px] text-slate-400">
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-brand-600"></span>Receita</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-slate-600"></span>Custo</span>
          </div>
        </div>
        ${barChart(fat.map(f=>({label:f.mes, a:f.receita, b:f.custo})))}
      </div>
      <div class="card p-5">
        <h3 class="font-semibold text-slate-100 mb-3">Composição do Estoque</h3>
        <div class="flex items-center gap-4">
          <div class="shrink-0">${donut(donutSegs)}</div>
          <div class="space-y-1.5 text-xs min-w-0">
            ${donutSegs.map(d=>`<div class="flex items-center gap-2 min-w-0"><span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${d.color}"></span><span class="text-slate-400 truncate">${d.label.split(' ').slice(0,2).join(' ')}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="card p-5">
      <div class="flex items-center gap-2 mb-4">
        <i data-lucide="brain-circuit" class="w-5 h-5 text-brand-400"></i>
        <h3 class="font-semibold text-slate-100">Insights automáticos do Motor de IA</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${insights.map(i=>{
          const map={warn:'text-amber-300 border-amber-500/20 bg-amber-500/5',error:'text-rose-300 border-rose-500/20 bg-rose-500/5',success:'text-emerald-300 border-emerald-500/20 bg-emerald-500/5',info:'text-brand-300 border-brand-500/20 bg-brand-500/5'};
          return `<div class="flex items-start gap-3 p-3 rounded-xl border ${map[i.type]}">
            <i data-lucide="${i.icon}" class="w-4 h-4 mt-0.5 shrink-0"></i>
            <div><p class="text-sm font-medium text-slate-100">${i.title}</p><p class="text-xs text-slate-400 mt-0.5">${i.text}</p></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      ${[
        {t:'Financeiro',h:'financeiro',i:'line-chart'},{t:'Logística',h:'logistica',i:'truck'},
        {t:'Estoque',h:'estoque',i:'boxes'},{t:'Fiscal',h:'fiscal',i:'scale'},
        {t:'NF-e / DANFE',h:'nfe',i:'file-text'},{t:'Nexus AI',h:'ai',i:'brain-circuit'}
      ].map(a=>`<a href="#${a.h}" class="card-soft p-4 flex flex-col items-center gap-2 hover:border-brand-600 transition group">
        <i data-lucide="${a.i}" class="w-5 h-5 text-slate-400 group-hover:text-brand-400"></i>
        <span class="text-xs text-slate-300 text-center">${a.t}</span>
      </a>`).join('')}
    </div>
  </div>`;
}

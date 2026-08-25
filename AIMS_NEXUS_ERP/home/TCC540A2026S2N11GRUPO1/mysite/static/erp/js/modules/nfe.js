import { state, setState } from '../store.js';
import { BRL, fmtDate, toast, openModal, closeModal, el, uid, qrImg } from '../utils.js';
import { NCM_LIST, CFOP_LIST } from '../data.js';

let itens = [];

export function renderNFe(view){
  view.innerHTML = `
  <div class="space-y-6">
    <div class="card p-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div><h3 class="font-semibold text-slate-100 flex items-center gap-2"><i data-lucide="file-text" class="w-4 h-4 text-brand-400"></i>Notas Fiscais Eletrônicas</h3><p class="text-xs text-slate-500 mt-0.5">Emissão simulada e geração de DANFE (modelo 55)</p></div>
        <button id="nova-nf" class="btn btn-primary !py-2 text-sm"><i data-lucide="plus" class="w-4 h-4"></i>Emitir NF-e</button>
      </div>
    </div>
    <div class="card p-5">
      <div class="overflow-x-auto"><table class="data w-full text-sm">
        <thead><tr class="text-left text-slate-500 text-xs border-b border-slate-800"><th class="py-2">Número</th><th>Destinatário</th><th>Data</th><th class="text-right">Valor</th><th>Status</th><th></th></tr></thead>
        <tbody id="nf-body"></tbody>
      </table></div>
    </div>
  </div>`;

  const body=view.querySelector('#nf-body');
  function draw(){
    body.innerHTML = state.notas.map(n=>`<tr class="border-b border-slate-800/60">
      <td class="py-2.5 font-mono text-xs text-slate-300">${n.numero}<span class="text-slate-600"> /${n.serie}</span></td>
      <td class="text-slate-200">${n.destinatario}<p class="text-[11px] text-slate-500">${n.cnpjDest||''}</p></td>
      <td class="text-slate-400">${fmtDate(n.data)}</td>
      <td class="text-right font-medium text-slate-100">${BRL(n.valor)}</td>
      <td><span class="pill ${n.status==='autorizada'?'bg-emerald-500/10 text-emerald-300':n.status==='cancelada'?'bg-rose-500/10 text-rose-300':'bg-amber-500/10 text-amber-300'}">${n.status}</span></td>
      <td class="text-right whitespace-nowrap">
        <button data-danfe="${n.id}" title="Ver DANFE" class="text-brand-400 hover:text-brand-300 p-1"><i data-lucide="eye" class="w-4 h-4"></i></button>
        <button data-del="${n.id}" title="Excluir" class="text-slate-500 hover:text-rose-400 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </td></tr>`).join('') || `<tr><td colspan="6" class="text-center text-slate-500 py-6">Nenhuma nota emitida.</td></tr>`;
    body.querySelectorAll('[data-danfe]').forEach(b=>b.addEventListener('click',()=>viewDanfe(b.dataset.danfe)));
    body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ setState(s=>{s.notas=s.notas.filter(x=>x.id!==b.dataset.del);}); draw(); window.lucideRefresh(); }));
    window.lucideRefresh();
  }
  draw();
  view.querySelector('#nova-nf').addEventListener('click',()=>emitir(draw));
}

function genChave(nf){
  const uf='35', aamm=new Date().toISOString().slice(2,7).replace('-',''), cnpj=state.empresa.cnpj.replace(/\D/g,'').padEnd(14,'0');
  const mod='55', serie=String(nf.serie).padStart(3,'0'), num=String(nf.numero).padStart(9,'0');
  const tp='1', cod=String(Math.floor(Math.random()*99999999)).padStart(8,'0');
  let base=uf+aamm+cnpj+mod+serie+num+tp+cod;
  // DV mod 11
  let peso=2,sum=0; for(let i=base.length-1;i>=0;i--){ sum+=(+base[i])*peso; peso=peso===9?2:peso+1; }
  const dv=(11-(sum%11)); const dig=(dv>=10)?0:dv;
  return base+dig;
}

function emitir(draw){
  itens=[];
  const form=el(`<div class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label class="text-xs text-slate-400">Destinatário (razão social)</label><input id="d-nome" class="field mt-1" placeholder="Cliente LTDA" required></div>
      <div><label class="text-xs text-slate-400">CNPJ/CPF</label><input id="d-doc" class="field mt-1" placeholder="00.000.000/0000-00"></div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div><label class="text-xs text-slate-400">Número</label><input id="d-num" class="field mt-1" value="${String((+ (state.notas[0]?.numero||4501))+1).padStart(9,'0')}"></div>
      <div><label class="text-xs text-slate-400">Série</label><input id="d-serie" class="field mt-1" value="1"></div>
      <div class="col-span-2"><label class="text-xs text-slate-400">Natureza da operação</label><input id="d-nat" class="field mt-1" value="Venda de mercadoria"></div>
    </div>
    <div class="card-soft p-3">
      <div class="flex items-center justify-between mb-2"><p class="text-sm font-medium text-slate-200">Itens da nota</p><button id="add-item" class="btn btn-ghost !py-1 !px-2 text-xs"><i data-lucide="plus" class="w-4 h-4"></i>Adicionar</button></div>
      <div id="itens-list" class="space-y-2"></div>
      <p id="tot" class="text-right text-sm text-slate-300 mt-2">Total: <b class="text-slate-100">R$ 0,00</b></p>
    </div>
    <div class="flex justify-end gap-2"><button type="button" data-close class="btn btn-ghost">Cancelar</button><button id="d-emit" class="btn btn-primary"><i data-lucide="send" class="w-4 h-4"></i>Emitir & Autorizar</button></div>
  </div>`);

  const list=form.querySelector('#itens-list');
  const redraw=()=>{
    list.innerHTML = itens.map((it,idx)=>`<div class="grid grid-cols-12 gap-2 items-center">
      <select data-i="${idx}" data-f="prod" class="field !py-1.5 col-span-6 text-xs">${state.produtos.map(p=>`<option value="${p.id}" ${p.id===it.prod?'selected':''}>${p.nome}</option>`).join('')}</select>
      <input data-i="${idx}" data-f="qtd" type="number" min="1" value="${it.qtd}" class="field !py-1.5 col-span-2 text-xs">
      <span class="col-span-3 text-right text-xs text-slate-300">${BRL(it.qtd*(state.produtos.find(p=>p.id===it.prod)?.preco||0))}</span>
      <button data-rm="${idx}" class="col-span-1 text-slate-500 hover:text-rose-400"><i data-lucide="x" class="w-4 h-4"></i></button>
    </div>`).join('') || '<p class="text-xs text-slate-500 text-center py-2">Adicione ao menos um item.</p>';
    const tot=itens.reduce((a,it)=>a+it.qtd*(state.produtos.find(p=>p.id===it.prod)?.preco||0),0);
    form.querySelector('#tot').innerHTML=`Total: <b class="text-slate-100">${BRL(tot)}</b>`;
    list.querySelectorAll('[data-f]').forEach(inp=>inp.addEventListener('input',e=>{ const i=+inp.dataset.i; if(inp.dataset.f==='qtd') itens[i].qtd=+inp.value||1; else itens[i].prod=inp.value; redraw(); }));
    list.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>{ itens.splice(+b.dataset.rm,1); redraw(); }));
    window.lucideRefresh();
  };
  form.querySelector('#add-item').addEventListener('click',()=>{ itens.push({prod:state.produtos[0].id,qtd:1}); redraw(); });
  itens.push({prod:state.produtos[0].id,qtd:10}); redraw();

  form.querySelector('[data-close]').addEventListener('click',closeModal);
  form.querySelector('#d-emit').addEventListener('click',()=>{
    const nome=form.querySelector('#d-nome').value.trim();
    if(!nome){ toast('Informe o destinatário.','warn'); return; }
    if(!itens.length){ toast('Adicione itens.','warn'); return; }
    const valor=itens.reduce((a,it)=>a+it.qtd*(state.produtos.find(p=>p.id===it.prod)?.preco||0),0);
    const nf={ id:uid('NF'), numero:form.querySelector('#d-num').value, serie:form.querySelector('#d-serie').value, data:new Date().toISOString().slice(0,10), destinatario:nome, cnpjDest:form.querySelector('#d-doc').value, valor, status:'autorizada', natOp:form.querySelector('#d-nat').value, itens:itens.map(it=>{ const p=state.produtos.find(x=>x.id===it.prod); return {nome:p.nome,ncm:p.ncm,cfop:p.cfop,qtd:it.qtd,unidade:p.unidade,preco:p.preco,total:it.qtd*p.preco}; }) };
    nf.chave=genChave(nf);
    setState(s=>{ s.notas.unshift(nf); });
    closeModal(); toast('NF-e autorizada com sucesso.','success'); draw();
    setTimeout(()=>viewDanfe(nf.id),300);
  });
  openModal('Emitir NF-e (modelo 55)', form, {wide:true});
}

function viewDanfe(id){
  const n=state.notas.find(x=>x.id===id); if(!n)return;
  const e=state.empresa;
  const itensHtml=(n.itens||[]).map((it,i)=>`<tr>
    <td class="border border-slate-400 px-1 py-0.5 text-[10px]">${String(i+1).padStart(3,'0')}</td>
    <td class="border border-slate-400 px-1 py-0.5 text-[10px]">${it.nome}</td>
    <td class="border border-slate-400 px-1 py-0.5 text-[10px] text-center">${it.ncm}</td>
    <td class="border border-slate-400 px-1 py-0.5 text-[10px] text-center">${it.cfop}</td>
    <td class="border border-slate-400 px-1 py-0.5 text-[10px] text-center">${it.unidade}</td>
    <td class="border border-slate-400 px-1 py-0.5 text-[10px] text-right">${it.qtd}</td>
    <td class="border border-slate-400 px-1 py-0.5 text-[10px] text-right">${it.preco.toFixed(2)}</td>
    <td class="border border-slate-400 px-1 py-0.5 text-[10px] text-right">${it.total.toFixed(2)}</td>
  </tr>`).join('') || `<tr><td colspan="8" class="border border-slate-400 text-center text-[10px] py-1 text-slate-500">Sem itens detalhados</td></tr>`;
  const chaveFmt=(n.chave||'').replace(/(\d{4})/g,'$1 ').trim();

  const node=el(`<div>
    <div id="danfe" class="bg-white text-black rounded-lg p-4 text-black" style="font-family:Arial,Helvetica,sans-serif">
      <div class="flex items-stretch border border-slate-500">
        <div class="w-2/5 border-r border-slate-500 p-2">
          <p class="font-bold text-sm">${e.razao}</p>
          <p class="text-[10px] leading-tight">${e.endereco}<br>${e.municipio} - ${e.uf} · CEP ${e.cep}<br>CNPJ: ${e.cnpj} · IE: ${e.ie}<br>${e.telefone}</p>
        </div>
        <div class="w-1/5 border-r border-slate-500 flex flex-col items-center justify-center p-1">
          <p class="font-bold text-xs">DANFE</p>
          <p class="text-[9px] text-center leading-tight">Documento Auxiliar da Nota Fiscal Eletrônica</p>
          <div class="flex items-center gap-2 mt-1"><span class="text-[9px]">0-entrada</span><span class="border border-black px-1 text-xs font-bold">1</span><span class="text-[9px]">1-saída</span></div>
          <p class="text-[10px] mt-1">Nº ${n.numero}</p><p class="text-[10px]">Série ${n.serie}</p>
        </div>
        <div class="w-2/5 p-2 flex flex-col items-center justify-center">
          <div style="max-width:180px">${qrImg('NFe'+ (n.chave||''),120)}</div>
        </div>
      </div>
      <div class="border-x border-b border-slate-500 p-1">
        <p class="text-[8px] uppercase text-slate-600">Chave de acesso</p>
        <p class="font-mono text-[11px] tracking-wide">${chaveFmt}</p>
      </div>
      <div class="border-x border-b border-slate-500 p-1 flex justify-between">
        <div><p class="text-[8px] uppercase text-slate-600">Natureza da operação</p><p class="text-[11px]">${n.natOp}</p></div>
        <div class="text-right"><p class="text-[8px] uppercase text-slate-600">Protocolo de autorização</p><p class="text-[11px]">${Math.floor(Math.random()*1e14)} · ${fmtDate(n.data)}</p></div>
      </div>
      <div class="border-x border-b border-slate-500 p-1">
        <p class="text-[8px] uppercase text-slate-600">Destinatário / Remetente</p>
        <p class="text-[11px] font-medium">${n.destinatario}</p>
        <p class="text-[10px]">${n.cnpjDest||'Documento não informado'} · Emissão ${fmtDate(n.data)}</p>
      </div>
      <table class="w-full border-collapse border border-slate-500 mt-1">
        <thead><tr class="bg-slate-100">
          ${['Item','Descrição do produto','NCM','CFOP','Un','Qtd','V.Unit','V.Total'].map(h=>`<th class="border border-slate-400 px-1 py-0.5 text-[9px] uppercase">${h}</th>`).join('')}
        </tr></thead>
        <tbody>${itensHtml}</tbody>
      </table>
      <div class="flex justify-end border border-slate-500 border-t-0 p-1">
        <div class="text-right"><p class="text-[8px] uppercase text-slate-600">Valor total da nota</p><p class="text-sm font-bold">${BRL(n.valor)}</p></div>
      </div>
      <p class="text-[8px] text-slate-500 mt-1">Documento emitido em ambiente de simulação (sem valor fiscal). Chave e protocolo gerados para demonstração.</p>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <button data-close class="btn btn-ghost">Fechar</button>
      <button id="print-danfe" class="btn btn-primary"><i data-lucide="printer" class="w-4 h-4"></i>Imprimir / PDF</button>
    </div>
  </div>`);
  const ov=openModal('DANFE · NF-e nº '+n.numero, node, {wide:true});
  node.querySelector('#danfe').id='print-area';
  node.querySelector('#print-danfe').addEventListener('click',()=>window.print());
  window.lucideRefresh();
}

import { state, setState } from '../store.js';
import { BRL, NUM, fmtDate, daysUntil, toast, openModal, closeModal, el, uid, ean13, eanValid, qrImg, csvExport } from '../utils.js';
import { NCM_LIST, CFOP_LIST, METODOS_ESTOQUE } from '../data.js';

export function renderEstoque(view){
  const prods = state.produtos;
  const totalUn = prods.reduce((a,p)=>a+p.lotes.reduce((x,l)=>x+l.qtd,0),0);
  const valor = prods.reduce((a,p)=>a+p.lotes.reduce((x,l)=>x+l.qtd*l.custo,0),0);
  const criticos = prods.filter(p=>p.lotes.reduce((a,l)=>a+l.qtd,0)<p.estMin).length;
  const vencendo = prods.reduce((a,p)=>a+p.lotes.filter(l=>l.validade&&daysUntil(l.validade)<30).length,0);

  view.innerHTML = `
  <div class="space-y-6">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${[
        {l:'SKUs',v:NUM(prods.length),i:'package',c:'#22d3ee'},
        {l:'Unidades em estoque',v:NUM(totalUn),i:'boxes',c:'#a78bfa'},
        {l:'Valor imobilizado',v:BRL(valor),i:'landmark',c:'#34d399'},
        {l:'Alertas',v:`${criticos}+${vencendo}`,i:'triangle-alert',c:'#fb7185',sub:`${criticos} baixo estoque · ${vencendo} vencendo`}
      ].map(k=>`<div class="card p-4"><div class="flex items-center justify-between"><p class="text-xs text-slate-500">${k.l}</p><i data-lucide="${k.i}" class="w-4 h-4" style="color:${k.c}"></i></div><p class="text-lg font-bold text-white mt-1">${k.v}</p>${k.sub?`<p class="text-[11px] text-slate-500">${k.sub}</p>`:''}</div>`).join('')}
    </div>

    <div class="card p-5">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 class="font-semibold text-slate-100 flex items-center gap-2"><i data-lucide="boxes" class="w-4 h-4 text-brand-400"></i>Produtos & Lotes</h3>
        <div class="flex gap-2">
          <input id="busca" class="field !w-52" placeholder="Buscar produto ou EAN...">
          <button id="exp" class="btn btn-ghost !py-2 text-xs"><i data-lucide="download" class="w-4 h-4"></i></button>
          <button id="novo" class="btn btn-primary !py-2 text-sm"><i data-lucide="plus" class="w-4 h-4"></i>Novo produto</button>
        </div>
      </div>
      <div class="overflow-x-auto"><table class="data w-full text-sm">
        <thead><tr class="text-left text-slate-500 text-xs border-b border-slate-800">
          <th class="py-2">Produto</th><th>EAN-13</th><th>NCM</th><th class="text-right">Estoque</th><th class="text-right">Preço</th><th>Etiquetas</th><th></th>
        </tr></thead>
        <tbody id="tbody"></tbody>
      </table></div>
    </div>
  </div>`;

  const tbody=view.querySelector('#tbody');
  function draw(filter=''){
    const f=filter.toLowerCase();
    tbody.innerHTML = prods.filter(p=>p.nome.toLowerCase().includes(f)||p.ean.includes(f)).map(p=>{
      const est=p.lotes.reduce((a,l)=>a+l.qtd,0);
      const baixo=est<p.estMin;
      const venc=p.lotes.some(l=>l.validade&&daysUntil(l.validade)<30);
      return `<tr class="border-b border-slate-800/60">
        <td class="py-2.5"><p class="text-slate-200 font-medium">${p.nome}</p><p class="text-[11px] text-slate-500">${p.id} · ${p.lotes.length} lote(s)${venc?' · <span class="text-rose-400">venc. próximo</span>':''}</p></td>
        <td class="font-mono text-xs text-slate-400">${p.ean}</td>
        <td class="text-slate-400 text-xs">${p.ncm}</td>
        <td class="text-right"><span class="${baixo?'text-rose-400 font-semibold':'text-slate-100'}">${NUM(est)}</span><span class="text-[11px] text-slate-600"> /${p.estMin}</span></td>
        <td class="text-right text-slate-100">${BRL(p.preco)}</td>
        <td><button data-etq="${p.id}" class="text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1"><i data-lucide="qr-code" class="w-4 h-4"></i>EAN/QR</button></td>
        <td class="text-right whitespace-nowrap">
          <button data-mov="${p.id}" title="Movimentar" class="text-slate-500 hover:text-brand-400 p-1"><i data-lucide="arrow-left-right" class="w-4 h-4"></i></button>
          <button data-edit="${p.id}" title="Editar" class="text-slate-500 hover:text-amber-400 p-1"><i data-lucide="pencil" class="w-4 h-4"></i></button>
          <button data-del="${p.id}" title="Excluir" class="text-slate-500 hover:text-rose-400 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td></tr>`;
    }).join('') || `<tr><td colspan="7" class="text-center text-slate-500 py-6">Nenhum produto encontrado.</td></tr>`;
    tbody.querySelectorAll('[data-etq]').forEach(b=>b.addEventListener('click',()=>etiqueta(b.dataset.etq)));
    tbody.querySelectorAll('[data-mov]').forEach(b=>b.addEventListener('click',()=>movimentar(b.dataset.mov,view,draw)));
    tbody.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editProduto(b.dataset.edit,view,draw)));
    tbody.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ if(confirm('Excluir produto?')){ setState(s=>{s.produtos=s.produtos.filter(x=>x.id!==b.dataset.del);}); draw(view.querySelector('#busca').value); toast('Produto excluído.','info'); window.lucideRefresh(); } }));
    window.lucideRefresh();
  }
  draw();
  view.querySelector('#busca').addEventListener('input',e=>draw(e.target.value));
  view.querySelector('#novo').addEventListener('click',()=>editProduto(null,view,draw));
  view.querySelector('#exp').addEventListener('click',()=>csvExport('estoque.csv',[['ID','Produto','EAN','NCM','CFOP','Estoque','Custo','Preço'],...prods.map(p=>[p.id,p.nome,p.ean,p.ncm,p.cfop,p.lotes.reduce((a,l)=>a+l.qtd,0),p.custo,p.preco])]));
}

function etiqueta(id){
  const p=state.produtos.find(x=>x.id===id); if(!p)return;
  const qrData=`${p.nome}|EAN:${p.ean}|NCM:${p.ncm}|R$${p.preco}`;
  const valid=eanValid(p.ean);
  const node=el(`<div class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="card-soft p-4 flex flex-col items-center">
        <p class="text-xs text-slate-400 mb-2 self-start flex items-center gap-1"><i data-lucide="barcode" class="w-4 h-4"></i>Código de barras EAN-13</p>
        <div class="bg-white rounded-lg p-3 w-full flex justify-center">${ean13(p.ean)}</div>
        <p class="text-[11px] mt-2 ${valid?'text-emerald-400':'text-rose-400'}">${valid?'Dígito verificador válido':'Dígito verificador inválido'}</p>
      </div>
      <div class="card-soft p-4 flex flex-col items-center">
        <p class="text-xs text-slate-400 mb-2 self-start flex items-center gap-1"><i data-lucide="qr-code" class="w-4 h-4"></i>QR Code do produto</p>
        <div class="flex justify-center">${qrImg(qrData,150)}</div>
        <p class="text-[11px] text-slate-500 mt-2 text-center break-all">${qrData}</p>
      </div>
    </div>
    <div class="card-soft p-4">
      <p class="font-medium text-slate-100">${p.nome}</p>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 mt-2">
        <span>Preço: <b class="text-slate-200">${BRL(p.preco)}</b></span>
        <span>NCM: <b class="text-slate-200">${p.ncm}</b></span>
        <span>CFOP: <b class="text-slate-200">${p.cfop}</b></span>
        <span>Unid.: <b class="text-slate-200">${p.unidade}</b></span>
      </div>
    </div>
    <div class="flex justify-end"><button onclick="window.print()" class="btn btn-ghost text-sm"><i data-lucide="printer" class="w-4 h-4"></i>Imprimir etiqueta</button></div>
  </div>`);
  const ov=openModal('Etiquetas · '+p.id, node, {wide:true});
  ov.querySelector('div.card')?.setAttribute('id','print-area');
  window.lucideRefresh();
}

function movimentar(id,view,draw){
  const p=state.produtos.find(x=>x.id===id); if(!p)return;
  const form=el(`<form class="space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-xs text-slate-400">Tipo</label><select name="tipo" class="field mt-1"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div>
      <div><label class="text-xs text-slate-400">Método</label><select name="metodo" class="field mt-1">${METODOS_ESTOQUE.map(m=>`<option>${m.id}</option>`).join('')}</select></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-xs text-slate-400">Lote</label><select name="lote" class="field mt-1"><option value="">(novo lote)</option>${p.lotes.map(l=>`<option value="${l.lote}">${l.lote} (${l.qtd} un)</option>`).join('')}</select></div>
      <div><label class="text-xs text-slate-400">Quantidade</label><input name="qtd" type="number" min="1" value="10" class="field mt-1"></div>
    </div>
    <div id="novo-lote" class="grid grid-cols-2 gap-3">
      <div><label class="text-xs text-slate-400">Novo lote (código)</label><input name="novolote" class="field mt-1" placeholder="ex: L2405"></div>
      <div><label class="text-xs text-slate-400">Validade</label><input name="validade" type="date" class="field mt-1"></div>
    </div>
    <div><label class="text-xs text-slate-400">Documento</label><input name="doc" class="field mt-1" placeholder="NF-e / Pedido"></div>
    <div class="flex justify-end gap-2 pt-2"><button type="button" data-close class="btn btn-ghost">Cancelar</button><button class="btn btn-primary">Registrar</button></div>
  </form>`);
  form.addEventListener('submit',e=>{
    e.preventDefault(); const d=Object.fromEntries(new FormData(form)); const qtd=+d.qtd;
    setState(s=>{
      const pr=s.produtos.find(x=>x.id===id);
      if(d.tipo==='entrada'){
        const loteCod=d.lote||d.novolote||('L'+uid('').slice(0,4));
        const ex=pr.lotes.find(l=>l.lote===loteCod);
        if(ex) ex.qtd+=qtd; else pr.lotes.push({lote:loteCod,qtd,entrada:new Date().toISOString().slice(0,10),validade:d.validade||'',custo:pr.custo});
      } else {
        let rest=qtd; const ord=[...pr.lotes];
        if(d.metodo==='FIFO') ord.sort((a,b)=>a.entrada.localeCompare(b.entrada));
        else if(d.metodo==='LIFO') ord.sort((a,b)=>b.entrada.localeCompare(a.entrada));
        else ord.sort((a,b)=>(a.validade||'9999').localeCompare(b.validade||'9999'));
        for(const l of ord){ if(rest<=0)break; const t=Math.min(l.qtd,rest); l.qtd-=t; rest-=t; }
        pr.lotes=pr.lotes.filter(l=>l.qtd>0);
      }
      s.movimentos.unshift({id:uid('M'),data:new Date().toISOString().slice(0,10),tipo:d.tipo,produto:id,lote:d.lote||d.novolote||'—',qtd,metodo:d.metodo,doc:d.doc||'—'});
    });
    closeModal(); toast('Movimentação registrada.','success'); draw(view.querySelector('#busca').value); window.lucideRefresh();
  });
  form.querySelector('[data-close]').addEventListener('click',closeModal);
  openModal('Movimentar · '+p.nome, form);
}

function editProduto(id,view,draw){
  const p = id? state.produtos.find(x=>x.id===id) : { nome:'',ean:'',ncm:'09011100',cfop:'5102',cst:'00',csosn:'102',unidade:'UN',custo:0,preco:0,estMin:10,lotes:[] };
  const form=el(`<form class="space-y-3">
    <div><label class="text-xs text-slate-400">Nome do produto</label><input name="nome" class="field mt-1" value="${p.nome}" required></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-xs text-slate-400">EAN-13</label><input name="ean" class="field mt-1 font-mono" value="${p.ean}" placeholder="789..." maxlength="13"><p id="ean-msg" class="text-[11px] mt-1 text-slate-500"></p></div>
      <div><label class="text-xs text-slate-400">Unidade</label><input name="unidade" class="field mt-1" value="${p.unidade}"></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-xs text-slate-400">NCM</label><select name="ncm" class="field mt-1">${NCM_LIST.map(n=>`<option value="${n.code}" ${n.code===p.ncm?'selected':''}>${n.code} — ${n.desc.slice(0,28)}</option>`).join('')}</select></div>
      <div><label class="text-xs text-slate-400">CFOP</label><select name="cfop" class="field mt-1">${CFOP_LIST.map(c=>`<option value="${c.code}" ${c.code===p.cfop?'selected':''}>${c.code} — ${c.desc.slice(0,26)}</option>`).join('')}</select></div>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div><label class="text-xs text-slate-400">Custo (R$)</label><input name="custo" type="number" step="0.01" class="field mt-1" value="${p.custo}"></div>
      <div><label class="text-xs text-slate-400">Preço (R$)</label><input name="preco" type="number" step="0.01" class="field mt-1" value="${p.preco}"></div>
      <div><label class="text-xs text-slate-400">Estoque mín.</label><input name="estMin" type="number" class="field mt-1" value="${p.estMin}"></div>
    </div>
    ${!id?`<div class="grid grid-cols-2 gap-3"><div><label class="text-xs text-slate-400">Qtd inicial</label><input name="qtd0" type="number" class="field mt-1" value="0"></div><div><label class="text-xs text-slate-400">Validade (opcional)</label><input name="val0" type="date" class="field mt-1"></div></div>`:''}
    <div class="flex justify-end gap-2 pt-2"><button type="button" data-close class="btn btn-ghost">Cancelar</button><button class="btn btn-primary">${id?'Salvar':'Cadastrar'}</button></div>
  </form>`);
  const eanInput=form.querySelector('[name=ean]'), eanMsg=form.querySelector('#ean-msg');
  const chk=()=>{ const v=eanInput.value.replace(/\D/g,''); if(v.length===13){ eanMsg.textContent=eanValid(v)?'✓ EAN válido':'✗ dígito verificador inválido'; eanMsg.className='text-[11px] mt-1 '+(eanValid(v)?'text-emerald-400':'text-rose-400'); } else eanMsg.textContent=v.length+'/13 dígitos'; };
  eanInput.addEventListener('input',chk); chk();
  form.addEventListener('submit',e=>{
    e.preventDefault(); const d=Object.fromEntries(new FormData(form));
    setState(s=>{
      if(id){ const pr=s.produtos.find(x=>x.id===id); Object.assign(pr,{nome:d.nome,ean:d.ean,ncm:d.ncm,cfop:d.cfop,unidade:d.unidade,custo:+d.custo,preco:+d.preco,estMin:+d.estMin}); }
      else {
        const np={id:uid('P'),nome:d.nome,ean:d.ean||'0000000000000',ncm:d.ncm,cfop:d.cfop,cst:'00',csosn:'102',unidade:d.unidade,custo:+d.custo,preco:+d.preco,estMin:+d.estMin,lotes:[]};
        if(+d.qtd0>0) np.lotes.push({lote:'L'+uid('').slice(0,4),qtd:+d.qtd0,entrada:new Date().toISOString().slice(0,10),validade:d.val0||'',custo:+d.custo});
        s.produtos.push(np);
      }
    });
    closeModal(); toast(id?'Produto atualizado.':'Produto cadastrado.','success'); draw(view.querySelector('#busca').value); window.lucideRefresh();
  });
  form.querySelector('[data-close]').addEventListener('click',closeModal);
  openModal(id?'Editar produto':'Novo produto', form, {wide:true});
}

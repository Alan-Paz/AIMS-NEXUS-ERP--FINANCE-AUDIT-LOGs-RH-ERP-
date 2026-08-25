// Códigos tributários e dados de referência (Brasil)

export const NCM_LIST = [
  { code:'22021000', desc:'Águas, refrigerantes e bebidas gaseificadas', aliqIPI:6, aliqICMS:18 },
  { code:'09011100', desc:'Café não torrado, não descafeinado', aliqIPI:0, aliqICMS:7 },
  { code:'19053100', desc:'Bolachas e biscoitos doces', aliqIPI:5, aliqICMS:18 },
  { code:'84713012', desc:'Máquinas automáticas p/ processamento de dados', aliqIPI:0, aliqICMS:18 },
  { code:'85171231', desc:'Telefones celulares (smartphones)', aliqIPI:15, aliqICMS:25 },
  { code:'62034200', desc:'Calças de algodão de uso masculino', aliqIPI:0, aliqICMS:18 },
  { code:'30049099', desc:'Medicamentos - outros', aliqIPI:0, aliqICMS:18 },
  { code:'27101259', desc:'Gasolinas - outras', aliqIPI:0, aliqICMS:25 },
  { code:'94036000', desc:'Móveis de madeira - outros', aliqIPI:5, aliqICMS:18 },
  { code:'48191000', desc:'Caixas de papel ou cartão ondulado', aliqIPI:0, aliqICMS:12 }
];

export const CFOP_LIST = [
  { code:'5101', desc:'Venda de produção do estabelecimento (dentro do estado)', tipo:'saida' },
  { code:'6101', desc:'Venda de produção do estabelecimento (fora do estado)', tipo:'saida' },
  { code:'5102', desc:'Venda de mercadoria adquirida de terceiros (dentro do estado)', tipo:'saida' },
  { code:'6102', desc:'Venda de mercadoria adquirida de terceiros (fora do estado)', tipo:'saida' },
  { code:'5405', desc:'Venda de mercadoria c/ ST (substituto tributário)', tipo:'saida' },
  { code:'1102', desc:'Compra para comercialização (dentro do estado)', tipo:'entrada' },
  { code:'2102', desc:'Compra para comercialização (fora do estado)', tipo:'entrada' },
  { code:'5949', desc:'Outra saída de mercadoria não especificada', tipo:'saida' },
  { code:'5152', desc:'Transferência de mercadoria adquirida de terceiros', tipo:'saida' }
];

// CST ICMS (Regime Normal - Lucro Real/Presumido)
export const CST_ICMS = [
  { code:'00', desc:'Tributada integralmente' },
  { code:'10', desc:'Tributada e com cobrança de ICMS por ST' },
  { code:'20', desc:'Com redução de base de cálculo' },
  { code:'40', desc:'Isenta' },
  { code:'41', desc:'Não tributada' },
  { code:'50', desc:'Suspensão' },
  { code:'51', desc:'Diferimento' },
  { code:'60', desc:'ICMS cobrado anteriormente por ST' },
  { code:'70', desc:'Com redução de BC e cobrança de ICMS por ST' },
  { code:'90', desc:'Outras' }
];

// CSOSN (Simples Nacional)
export const CSOSN = [
  { code:'101', desc:'Tributada pelo Simples com permissão de crédito' },
  { code:'102', desc:'Tributada pelo Simples sem permissão de crédito' },
  { code:'103', desc:'Isenção do ICMS no Simples p/ faixa de receita bruta' },
  { code:'201', desc:'Tributada c/ permissão de crédito e c/ ICMS por ST' },
  { code:'202', desc:'Tributada s/ permissão de crédito e c/ ICMS por ST' },
  { code:'300', desc:'Imune' },
  { code:'400', desc:'Não tributada pelo Simples Nacional' },
  { code:'500', desc:'ICMS cobrado anteriormente por ST ou antecipação' },
  { code:'900', desc:'Outros' }
];

export const CST_PIS_COFINS = [
  { code:'01', desc:'Operação tributável - alíquota básica' },
  { code:'02', desc:'Operação tributável - alíquota diferenciada' },
  { code:'04', desc:'Operação tributável - monofásica (alíquota zero)' },
  { code:'06', desc:'Operação tributável - alíquota zero' },
  { code:'07', desc:'Operação isenta da contribuição' },
  { code:'08', desc:'Operação sem incidência da contribuição' },
  { code:'49', desc:'Outras operações de saída' }
];

export const CST_IPI = [
  { code:'50', desc:'Saída tributada' },
  { code:'51', desc:'Saída tributável com alíquota zero' },
  { code:'52', desc:'Saída isenta' },
  { code:'53', desc:'Saída não tributada' },
  { code:'99', desc:'Outras saídas' }
];

export const REGIMES = ['Simples Nacional','Lucro Presumido','Lucro Real'];

export const MODAIS = [
  { id:'rodoviario', nome:'Rodoviário', custoKm:2.85, co2:0.089, prazoBase:2, icon:'truck' },
  { id:'ferroviario', nome:'Ferroviário', custoKm:0.95, co2:0.022, prazoBase:5, icon:'train-front' },
  { id:'aquaviario', nome:'Aquaviário/Cabotagem', custoKm:0.65, co2:0.015, prazoBase:9, icon:'ship' },
  { id:'aereo', nome:'Aéreo', custoKm:6.40, co2:0.602, prazoBase:1, icon:'plane' },
  { id:'dutoviario', nome:'Dutoviário', custoKm:0.42, co2:0.005, prazoBase:3, icon:'git-commit-horizontal' }
];

export const METODOS_ESTOQUE = [
  { id:'FIFO', nome:'FIFO', desc:'First In, First Out — primeiro que entra, primeiro que sai' },
  { id:'FEFO', nome:'FEFO', desc:'First Expired, First Out — primeiro a vencer, primeiro a sair' },
  { id:'LIFO', nome:'LIFO', desc:'Last In, First Out — último que entra, primeiro que sai' }
];

// Empresa demo
export const EMPRESA_DEFAULT = {
  razao:'AIMS NEXUS ERP TECNOLOGIA  e Distribuição LTDA',
  fantasia:'AIMS NEXUS ERP',
  cnpj:'30611878000124/0001-24',
  ie:'110.042.490.114',
  regime:'MICRO EMPRESA',
  endereco:'RUA TREZE DE JUNHO , 78 - TIJUCAS SC',
  municipio:'TIJUCAS', uf:'SC', cep:'88200-458',
  telefone:'(11) 912459458', email:'alan.paz@estudantes.ifc.edu.br'
};

// Produtos seed (com lotes p/ FIFO/FEFO/LIFO)
export function seedProdutos() {
  const hoje = new Date();
  const d = (days) => new Date(hoje.getTime()+days*86400000).toISOString().slice(0,10);
  const dp = (days) => new Date(hoje.getTime()-days*86400000).toISOString().slice(0,10);
  return [
    { id:'P001', nome:'Café Torrado Premium 500g', ean:'7891000315507', ncm:'09011100', cfop:'5102', cst:'00', csosn:'102', unidade:'UN', custo:12.40, preco:24.90, estMin:80,
      lotes:[ {lote:'L2401', qtd:120, entrada:dp(40), validade:d(60), custo:11.90}, {lote:'L2402', qtd:200, entrada:dp(12), validade:d(120), custo:12.40} ] }

  ];
}

export function seedMovimentos() {
  const hoje = new Date();
  const dp = (days) => new Date(hoje.getTime()-days*86400000).toISOString().slice(0,10);
  return [
    { id:'M001', data:dp(40), tipo:'entrada', produto:'P001', lote:'L2401', qtd:120, metodo:'FEFO', doc:'NF-e 2201' }

  ];
}

export function seedFinanceiro() {
  const hoje = new Date();
  const dm = (m) => { const x=new Date(hoje); x.setMonth(x.getMonth()+m); return x.toISOString().slice(0,10); };
  return {
    receber:[
      { id:'AR1', cliente:'Supermercado Ideal', valor:18450.00, venc:dm(0), status:'pendente', doc:'NF 4501' }

    ],
    pagar:[
      { id:'AP1', fornecedor:'Torrefação Central', valor:9800.00, venc:dm(0), status:'pendente', doc:'Boleto 88121' }

    ],
    faturamento:[
      { mes:'Jan', receita:0, custo:0 }, { mes:'Fev', receita:0, custo:0 },
      { mes:'Mar', receita:0, custo:0 }, { mes:'Abr', receita:0, custo:0 },
      { mes:'Mai', receita:0, custo:0 }, { mes:'Jun', receita:0, custo:0 }
    ]
  };
}

export function seedNotas() {
  return [
    { id:'NF001', numero:'000004501', serie:'1', data:new Date().toISOString().slice(0,10), destinatario:'EMBALAGEM', cnpjDest:'', valor:0, status:'autorizada', natOp:'Venda de mercadoria', chave:'' }
  ];
}

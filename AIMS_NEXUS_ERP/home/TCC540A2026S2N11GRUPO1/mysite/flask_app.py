

from flask import Flask, render_template, request, url_for, redirect
 #from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == 'GET':
        return render_template("index.html")




if __name__ == '__main__':
    app.run(debug=True)

    from flask import Flask, request

app = Flask(__name__)

@app.route('/')
def index():
    return "Servidor Flask em execução."

@app.route('/receive_data', methods=['POST'])
def receive_data():
    if request.method == 'POST':
        try:
            message = request.form['message']
            # Faça o que quiser com a mensagem recebida, como exibir no console
            print("Mensagem recebida:", message)
            # Retorne uma resposta para o Arduino
            return 'Mensagem recebida com sucesso', 200  # Código de resposta HTTP 200 (OK)
        except KeyError:
            return 'Erro: mensagem ausente', 400  # Código de resposta HTTP 400 (Bad Request)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)



from flask import Flask, render_template, request
app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/', methods=["GET", "POST"])
def enviar_dados():
    temperatura = request.form['temperatura']
    # Envie a temperatura para o ESP8266
    # Implemente a lógica para enviar os dados para o ESP8266 aqui
    return 'Dados enviados com sucesso para o ESP8266!'

if __name__ == '__main__':
    app.run(debug=True)






from flask import Flask, request, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/', methods=['POST'])
def gpio_data():
    if request.method == 'POST':
        gpio1 = request.form['gpio1']
        gpio2 = request.form['gpio2']
        gpio3 = request.form['gpio3']
        # Faça o que quiser com os dados recebidos, como armazenar em um banco de dados ou processá-los de alguma outra maneira
        print("GPIO 1:", gpio1)
        print("GPIO 2:", gpio2)
        print("GPIO 3:", gpio3)
        return 'Dados recebidos com sucesso'

if __name__ == '__main__':
    app.run(debug=True)


#############################################################################

# --- MANTENHA SUAS IMPORTAÇÕES E ROTAS EXISTENTES ACIMA ---

import requests
from bs4 import BeautifulSoup
import networkx as nx
from flask import jsonify

# --- ADICIONE ESTA NOVA ROTA NO SEU FLASK_APP.PY ---
@app.route('/api/analise', methods=['GET'])
def executar_analise_portal():
    url = "https://tcc540a2026s2n11grupo1.pythonanywhere.com/static/dashboard_produtividade.html"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    # 1. Scraping com BeautifulSoup
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            titulo = soup.title.string.strip() if soup.title else "Sem título"
            links = [a.get('href') for a in soup.find_all('a') if a.get('href')]
            iframes = [iframe.get('src') for iframe in soup.find_all('iframe') if iframe.get('src')]
            scripts = [s.get('src') for s in soup.find_all('script') if s.get('src')]
        else:
            titulo, links, iframes, scripts = "Erro HTTP", [], [], []
    except Exception as e:
        titulo, links, iframes, scripts = f"Erro: {e}", [], [], []

    # 2. Análise de Grafos & GNN
    G = nx.DiGraph()
    G.add_node("Portal_Dashboard", type="Core", risk_score=0.8)

    for i, link in enumerate(links):
        node_id = f"Link_{i+1}"
        G.add_node(node_id, type="External_Link", target=link)
        G.add_edge("Portal_Dashboard", node_id, relation="NAVIGATES_TO")

    for i, iframe in enumerate(iframes):
        node_id = f"Iframe_{i+1}"
        G.add_node(node_id, type="Embedded_Doc", target=iframe)
        G.add_edge("Portal_Dashboard", node_id, relation="EMBEDS")

    degree_centrality = nx.degree_centrality(G)
    pagerank = nx.pagerank(G)

    nodes_data = []
    for node in G.nodes():
        nodes_data.append({
            "id": node,
            "type": G.nodes[node].get("type", "Unknown"),
            "pagerank": round(pagerank[node], 4),
            "degree": round(degree_centrality[node], 4)
        })

    # 3. Mapeamento ISO/IEC 42001
    iso_checks = [
        {
            "controle": "A.6 (Rastreabilidade e Logs)",
            "status": "NÃO CONFORME",
            "detalhe": "Sem logs imutáveis de alterações de métricas no frontend."
        },
        {
            "controle": "A.8 (Transparência e Explicabilidade)",
            "status": "PARCIALMENTE CONFORME",
            "detalhe": "Métricas exibidas não apresentam a origem/fórmula do cálculo."
        },
        {
            "controle": "Cláusula 6.1 (Apreciação de Riscos de IA)",
            "status": "REQUER ATENÇÃO",
            "detalhe": "Suscetível a injeção/spoofing de dados nos modelos preditivos."
        },
        {
            "controle": "Cláusula 8.2 (Avaliação de Impacto - AIIA)",
            "status": "PENDENTE",
            "detalhe": "Falta avaliação de impacto no processamento de transcrições de reuniões."
        }
    ]

    return jsonify({
        "scraping": {
            "titulo": titulo,
            "total_links": len(links),
            "total_iframes": len(iframes),
            "total_scripts": len(scripts)
        },
        "gnn_graph": {
            "total_nodes": G.number_of_nodes(),
            "total_edges": G.number_of_edges(),
            "nodes": nodes_data,
            "insights": "O nó 'Portal_Dashboard' concentra risco elevado na propagação de mensagens do grafo devido à falta de isolamento."
        },
        "iso_42001": iso_checks
    })
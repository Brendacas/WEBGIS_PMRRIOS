function carregarTabelaOrcamento(nomeArquivo) {
  const caminho = `dados/Ilhéus/Tabelas-Ficha/${nomeArquivo}`;

  fetch(caminho)
    .then(response => {
      if (!response.ok) throw new Error("Arquivo não encontrado: " + nomeArquivo);
      return response.json();
    })
    .then(dados => {
      // Preenchimento de Campos de Cabeçalho 
      const infoGeral = dados[0] || {};
      
      // Mapeamento de IDs 
      const elementos = {
       "o-codAlto": infoGeral.CODIGO_ALTO,
        "o-descricao": infoGeral["DESCRIÇÃO DO ITEM"],
        "o-soma": infoGeral.Soma 
      };

      // Atualiza o DOM apenas se o elemento existir
      Object.keys(elementos).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = elementos[id] || "";
      });

      // 2. Construção da Tabela Dinâmica
      const corpoTabela = document.getElementById("corpo-tabela-orcamento"); 
      if (corpoTabela) {
        corpoTabela.innerHTML = ""; // Limpa a tabela antes de carregar

        dados.forEach(linha => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${linha.CODIGO_ALTO || ""}</td>
            <td>${linha.CODIGO_ORSE || ""}</td>
            <td>${linha.ITEM || ""}</td>
            <td>${linha["DESCRIÇÃO DO ITEM"] || ""}</td>
            <td>${linha.UNID || ""}</td>
            <td>${linha.QUANT || 0}</td>
            <td>${linha.PRECO_UNIT ? linha.PRECO_UNIT.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
            <td>${linha["Valor Parcial"] ? linha["Valor Parcial"].toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : "-"}</td>
            <td>${linha.soma_parcial ? linha.soma_parcial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
            <td>${linha["Parcial (%)"] || ""}</td>
            <td>${linha["Soma"] ? linha["Soma"].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-"}</td>
          `;
          corpoTabela.appendChild(tr);
        });
      }

      // 3. Gestão de Layout e Mapa
      const app = document.getElementById("app");
      app.classList.remove("com-tabela", "com-area", "com-quadro", "com-tabelaIntervencao");
      app.classList.add("com-planilhaOrcamento");

      setTimeout(() => {
        if (typeof map !== 'undefined') map.invalidateSize();
      }, 300);
    })
    .catch(err => {
      console.error("Erro ao carregar ficha:", err);
    });
}


const listadeInundacoes = [
    {nome: "Inundação Esperança", arquivo: "dados/Ilhéus/GeoJSON/inundação_Esperança.geojson"}
]
function carregarInundacao({arquivo, nomeInundacao}){
    console.log(`Carregando: ${nomeInundacao}...`)

    if(!bancoDeDadosInundacoes[nomeInundacao]){
        bancoDeDadosInundacoes[nomeInundacao] = [];
    }

    fetch(arquivo)
    .then(response => response.json())
    .then(data =>{
            const processarCamada = (filtro, estilo, grupoDestino, interacaoPersonalizada) => {
                const camada = L.geoJSON(data, {
                    filter: filtro,
                    style: estilo,
                    onEachFeature: interacaoPersonalizada || onEachFeaturePadrao, 
                    pointToLayer: (feature, latlng) => {
                        if (grupoDestino === camadasGlobais.coletor) {
                            return L.circle(latlng, estilo);
                        }
                        return L.marker(latlng);
                    }
                })
            };
            const comparaNome = (prop) => prop && prop.toString().trim().toUpperCase() === nomeInundacao.toString().trim().toUpperCase();
        
            processarCamada(
                f => comparaNome(f.properties.AreaInundacao), 
                { color: "#FF8C69", weight: 4, fill: true, fillOpacity: 0.1 }, 
                camadasGlobais.limites,
                menuSelecaoTabelasLimite
                //criarInteracaoComMidia("dados/Ilhéus/Fotos", carregarTabelaIntervencao) 
            );
            
    })
}

const selectElementInun = document.getElementById('selectInundacao');
listadeInundacao.forEach(inundacao =>{
    const option = document.createElement("option");
    option.valie = inundacao.nome;
    option.text = inundacao.nome;
    selectElementInun.appendChild(option);

    carregarInundacao({
        arquivo: inundacao.arquivo,
        nomeInundacao : inundacao.nome
    });
})
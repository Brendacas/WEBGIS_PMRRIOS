import json


json_data = 'dados/Ilheus/Tabelas-Ficha/Relatorio122024.json'
json_saida = 'OrcLimites.json'
json_saidaRisco = 'OrcAreaRisco.json'
json_saidaArea = 'OrcArea.json'
try:
    with open(json_data, 'r', encoding='utf-8') as f:
        dados = json.load(f)
    # Validação: garantir que seja uma lista de dicionários
    if not isinstance(dados, list) or not all(isinstance(item, dict) for item in dados):
        raise ValueError("O JSON não está no formato esperado (lista de objetos).")
    
   
    filtrados_setor = [p for p in dados 
               if p.get(("DESCRIÇÃO DO ITEM"),str) and "Setor" in p.get("DESCRIÇÃO DO ITEM")]
    filtrados_obras = [
        p for p in dados 
        if p.get("CODIGO_ALTO") is not None 
        and "ESPCAR_01" in str(p.get("CODIGO_ALTO"))
        and p.get("PRECO_UNIT") == "-"
        and p.get("Valor Parcial") == "-"
    ]
    filtrados_area = [p for p in dados
                if p.get(("CODIGO_ALTO"),str) and "ESPCAR_A1S1R3" in p.get("CODIGO_ALTO") 
                ]
    filtrados = [p for p in dados
                if p.get(("DESCRIÇÃO DO ITEM"),str) and "Setor de Risco A1" in p.get("DESCRIÇÃO DO ITEM") ]

    # Exibir resultado formatado
    print(json.dumps(filtrados_setor, indent=4, ensure_ascii=False))
    print(json.dumps(filtrados_obras, indent=4, ensure_ascii=False))
    
    dados = {
        "setor": filtrados_setor,
        "obras": filtrados_obras
    }

    with open(json_saida, 'w', encoding='utf-8') as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)
        
    with open(json_saidaRisco, 'w', encoding='utf-8') as f:
        json.dump(filtrados_area, f, indent=4, ensure_ascii=False)
    
    with open(json_saidaArea, 'w', encoding='utf-8') as f:
        json.dump(filtrados, f, indent=4, ensure_ascii=False)
        
except json.JSONDecodeError:
    print("Erro: O JSON fornecido é inválido.")
except ValueError as e:
    print(f"Erro de validação: {e}")
except Exception as e:
    print(f"Ocorreu um erro inesperado: {e}")

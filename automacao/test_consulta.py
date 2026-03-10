import pandas as pd
import os
import re

# Caminhos dos arquivos
caminho_interno = r"automacao/Relatorio_Carvalho_Codigos.xlsx"
caminho_externo = r"automacao/Resultado_Consulta_ORSE.xlsx"


def processar_excel(caminho):
    if not os.path.exists(caminho):
        print(f"Erro: O arquivo '{caminho}' não foi encontrado.")
        return None
    try:
        print("Lendo os dados externos...")
        dfe = pd.read_excel(caminho)
        
        print(f"Sucesso: {len(dfe)} linhas carregadas do arquivo externo.")
        return dfe
    except Exception as e:
        print(f"Erro ao processar o Excel externo: {e}")
        return None
    

def ajustar_padrao_sinapi(valor):
    if pd.isna(valor) or str(valor).lower() == 'nan':
        return "vazio"
    
    # 1. Limpeza básica: remove espaços e transforma em maiúsculo
    texto = str(valor).upper().strip().replace(" ", "")
    
    match_numero = re.search(r'\d+', texto)
    match_texto = re.search(r'[A-Z]+', texto)
    
    # 2. Verifica se termina com SINAPI
    if texto.endswith("SINAPI"):
        # Extrai apenas a parte numérica
        match_numero = re.search(r'\d+', texto)
        if match_numero:
            num_original = match_numero.group()
            
            # REGRA: Se o primeiro número é 0, vira 1 (ex: 089 -> 189 ou 1089)
            # Se você quer ADICIONAR o 1 na frente do 0: f"1{num_original}"
            # Se você quer SUBSTITUIR o 0 por 1: f"1{num_original[1:]}"
            if num_original.startswith("0"):
                novo_num = "1" + num_original # Adiciona 1 na frente do 0
                texto = texto.replace(num_original, novo_num)
    else:
        num_limpo = str(int(match_numero.group()))
        txt_limpo = match_texto.group() if match_texto else ""
        return f"{num_limpo}{txt_limpo}"

    
    # 3. Limpeza final para o merge (remove caracteres especiais)
    texto_limpo = texto.replace(".", "").replace("-", "").replace("/", "")
    return texto_limpo


# --- APLICANDO NA AUTOMAÇÃO ---

df_interno = processar_excel(caminho_interno)
df_externo = processar_excel(caminho_externo)


# Criando as chaves com a nova regra do SINAPI
df_interno['chave_sinapi'] = df_interno['CODIGO_ORSE'].apply(ajustar_padrao_sinapi)
df_externo['chave_sinapi'] = df_externo['CODIGO_ORSE'].apply(ajustar_padrao_sinapi)

# Criando as chaves com a nova regra do SINAPI
#df_interno['chave_sinapi'] = df_interno['CODIGO_ORSE'].apply(extrair_apenas_numeros_e_texto)
#df_externo['chave_sinapi'] = df_externo['CODIGO_ORSE'].apply(extrair_apenas_numeros_e_texto)

# Merge
df_merge = pd.merge(
    df_interno, 
    df_externo[['chave_sinapi', 'CUSTO_UNIT.']], 
    on='chave_sinapi', 
    how='left'
)

# Substituição do Preço pelo Custo
df_merge['PRECO_UNIT'] = df_merge['CUSTO_UNIT.'].fillna(df_merge['PRECO_UNIT'])

# Verificação
matches = df_merge[df_merge['CUSTO_UNIT.'].notna()]
print(f"Total de Matches encontrados: {len(matches)}")
if not matches.empty:
    print("\nExemplos de SINAPI ajustados:")
    print(matches[['CODIGO_ORSE', 'chave_sinapi', 'PRECO_UNIT']].head())

# Salvar
df_final = df_merge.drop(columns=['chave_sinapi', 'CUSTO_UNIT.'])
# 1. Garantir que os dados são numéricos (limpando R$ e trocando vírgula por ponto)
df_final['PRECO_UNIT'] = df_final['PRECO_UNIT'].replace(r'[R\$\s\.]', '', regex=True).replace(',', '.', regex=True).astype(float)
df_final['QUANT'] = df_final['QUANT'].astype(float)

# 2. Realizar a multiplicação
df_final['Valor Parcial'] = df_final['PRECO_UNIT'] * df_final['QUANT']
df_final.to_excel('Relatorio_Sincronizado_Sinapi.xlsx', index=False)


# 1. Garantir que ITEM seja string e Valor Parcial seja float
df_final['ITEM'] = df_final['ITEM'].astype(str)
df_final['Valor Parcial'] = df_final['Valor Parcial'].astype(float)

# 2. Subir a hierarquia do nível 5 até o 2
# Vamos usar um loop para evitar erros de copiar e colar
for nivel_filho in [5, 4, 3]:
    nivel_pai = nivel_filho - 1
    
    # Identifica quem é o pai de cada item do nível atual
    col_aux = f'PAI_TEMP_{nivel_filho}'
    df_final[col_aux] = df_final.apply(
        lambda x: ".".join(x['ITEM'].split('.')[:-1]) if x['PONTOS'] == nivel_filho else None, 
        axis=1
    )
    
    # Agrupa os valores dos filhos para o pai
    soma_filhos = df_final.groupby(col_aux)['Valor Parcial'].sum().reset_index()
    soma_filhos.columns = ['ITEM', 'SOMA_AGRUPADA']
    
    # Traz a soma para o DataFrame principal
    df_final = pd.merge(df_final, soma_filhos, on='ITEM', how='left')
    
    # Se o pai (Nível N-1) estiver zerado, ele recebe a soma dos seus filhos (Nível N)
    mask = (df_final['PONTOS'] == nivel_pai) & (df_final['Valor Parcial'] == 0)
    df_final.loc[mask, 'Valor Parcial'] = df_final['SOMA_AGRUPADA']
    
    # Limpa colunas temporárias para a próxima rodada
    df_final = df_final.drop(columns=[col_aux, 'SOMA_AGRUPADA']).fillna(0)

# --- CÁLCULOS FINAIS (Nível 1 e Totais) ---

# 2. Crie o PAI_RAIZ (ex: '04')
df_final['PAI_RAIZ'] = df_final['ITEM'].apply(lambda x: str(x).split('.')[0])

# --- CORREÇÃO DA SOMA TOTAL ---
# Em vez de somar PONTOS >= 2 (que duplica valores), 
# somamos APENAS o Nível 2, que já é o acumulador dos níveis 3, 4 e 5.

# Total por Grupo (ex: Total do grupo 04, total do grupo 05)
soma_total_por_grupo = df_final[df_final['PONTOS'] == 2].groupby('PAI_RAIZ')['Valor Parcial'].sum()

# Total Geral do Orçamento/Projeto
soma_total_geral = df_final[df_final['PONTOS'] == 2]['Valor Parcial'].sum()

print(f"Soma Total Consolidada (Nível 2): {soma_total_geral}")



# Somas Hierárquicas (Cálculos em float)
# --- NÍVEL 5 para NÍVEL 4 ---
df_final['PAI_N5'] = df_final.apply(lambda x: ".".join(x['ITEM'].split('.')[:-1]) if x['PONTOS'] == 5 else None, axis=1)
soma_n5 = df_final.groupby('PAI_N5')['Valor Parcial'].sum().reset_index().rename(columns={'PAI_N5': 'ITEM', 'Valor Parcial': 'SOMA_N5'})
df_final = pd.merge(df_final, soma_n5, on='ITEM', how='left').fillna(0)
df_final.loc[(df_final['PONTOS'] == 4) & (df_final['Valor Parcial'] == 0), 'Valor Parcial'] = df_final['SOMA_N5']

# --- NÍVEL 4 para NÍVEL 3 --- 04.02.002.002
df_final['PAI_N4'] = df_final.apply(lambda x: ".".join(x['ITEM'].split('.')[:-1]) if x['PONTOS'] == 4 else None, axis=1)
soma_n4 = df_final.groupby('PAI_N4')['Valor Parcial'].sum().reset_index().rename(columns={'PAI_N4': 'ITEM', 'Valor Parcial': 'SOMA_N4'})
df_final = pd.merge(df_final, soma_n4, on='ITEM', how='left').fillna(0)
# Se o Nível 3 estiver zerado, assume a soma dos seus filhos Nível 4
df_final.loc[(df_final['PONTOS'] == 3) & (df_final['Valor Parcial'] == 0), 'Valor Parcial'] = df_final['SOMA_N4']

# --- NÍVEL 3 para NÍVEL 2  ---
df_final['PAI_N3'] = df_final.apply(lambda x: ".".join(x['ITEM'].split('.')[:-1]) if x['PONTOS'] == 3 else None, axis=1)
soma_n3 = df_final.groupby('PAI_N3')['Valor Parcial'].sum().reset_index().rename(columns={'PAI_N3': 'ITEM', 'Valor Parcial': 'SOMA_N3'})
df_final = pd.merge(df_final, soma_n3, on='ITEM', how='left').fillna(0)
df_final.loc[(df_final['PONTOS'] == 2) & (df_final['Valor Parcial'] == 0), 'Valor Parcial'] = df_final['SOMA_N3']

# Nível 3 -> 2 (Soma Parcial do 01.01)
df_final['PAI_N2'] = df_final.apply(lambda x: ".".join(x['ITEM'].split('.')[:-2]) if x['PONTOS'] == 3 else None, axis=1)
soma_n2 = df_final.groupby('PAI_N2')['Valor Parcial'].sum().reset_index().rename(columns={'PAI_N2': 'ITEM', 'Valor Parcial': 'SOMA_N2'})
df_final = pd.merge(df_final, soma_n2, on='ITEM', how='left').fillna(0)
df_final['soma_parcial'] = df_final['SOMA_N2']


#SOMA 
# Nível 2 -> 1 (Soma 01 - 1)
df_final['ITEM_KEY'] = pd.to_numeric(df_final['ITEM'], errors='coerce') # Converte para numérico para ignorar se é "01" ou "1"
df_final['PAI_N1'] = df_final.apply(lambda x: pd.to_numeric(".".join(x['ITEM'].split('.')[:-3]), errors='coerce')  if x['PONTOS'] == 3 else None, axis=1)
soma_n1 = df_final.groupby('PAI_N1')['Valor Parcial'].sum().reset_index()
soma_n1.columns = ['ITEM_KEY', 'SOMA_N1']
df_final = pd.merge(df_final, soma_n1, on='ITEM_KEY', how='left')
df_final['Soma'] = df_final['SOMA_N1'].fillna(0)


soma_n0 = soma_n1.sum()

df_final['DESCRIÇÃO DO ITEM'] = df_final['DESCRIÇÃO DO ITEM'].astype(str).str.strip()
df_final['CODIGO_ALTO'] = df_final['CODIGO_ALTO'].astype(str).str.strip()

# Força a coluna Soma a ser do tipo float
df_final['Soma'] = pd.to_numeric(df_final['Soma'], errors='coerce')


# 1. Localizamos os valores dos filhos
valor_filho_1 = df_final.loc[df_final['ITEM'] == '04.02.002.001', 'Valor Parcial'].max()
valor_filho_2 = df_final.loc[df_final['ITEM'] == '04.02.002.002', 'Valor Parcial'].max()

# 2. Atribuímos a soma ao pai (04.02.002)
test = df_final.loc[df_final['ITEM'] == '04.02.002', 'Valor Parcial'] = valor_filho_1 + valor_filho_2
print(test)
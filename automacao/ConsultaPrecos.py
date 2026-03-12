import pandas as pd
import numpy as np
import os
import re


# Caminhos dos arquivos
caminho_interno = r"automacao/Relatorio_Carvalho_Codigos.xlsx"
caminho_externo = r"automacao/Resultado_Consulta_ORSE_2025-12-1.xlsx"


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
def ajustar_padrao_codigo(valor):
    if pd.isna(valor) or str(valor).lower() == 'nan':
        return "vazio"
    
    # Limpeza básica: remove espaços e transforma em maiúsculo
    texto = str(valor).upper().strip().replace(" ", "")
    
    match_numero = re.search(r'\d+', texto)
    match_texto = re.search(r'[A-Z]+', texto)
    
    # Verifica se termina com SINAPI
    if texto.endswith("SINAPI"):
        # Extrai apenas a parte numérica
        match_numero = re.search(r'\d+', texto)
        if match_numero:
            num_original = match_numero.group()
            
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
def limpar_valor_real(valor):
    if pd.isna(valor) or str(valor).strip() == '':
        return 0.0
    v = str(valor).replace('R$', '').replace(' ', '')
    if ',' in v and '.' in v:
        v = v.replace('.', '')
    v = v.replace(',', '.')
    try:
        return float(v)
    except:
        return 0.0 
def formatar_brl_final(valor):
    try:
        # remove R$, espaços e ajusta separadores
        if isinstance(valor, str):
            valor = valor.replace('R$', '').replace('.', '').replace(',', '.').strip()
        
        # 2. Converte para float
        n = float(valor)
        
        if n == 0:
            return "-"
        if pd.isna(valor) or valor == "" or valor is None:
            return "-"
        
        # f-string formatando milhar com vírgula e decimal com ponto
        texto = f"{n:,.2f}"
        
        # Troca a vírgula do milhar por PONTO e o ponto do decimal por VÍRGULA
        return "R$ " + texto.replace(',', 'X').replace('.', ',').replace('X', '.')
    
    except (ValueError, TypeError):
        # Se não for número de jeito nenhum, retorna o que era antes
        return valor
    
# Chamando o excel
df_interno = processar_excel(caminho_interno)
df_externo = processar_excel(caminho_externo)

# Renomear a coluna 
df_interno = df_interno.rename(columns={'Unnamed: 9': 'soma_parcial'})

# Criando as chaves
df_interno['chave_sinapi'] = df_interno['CODIGO_ORSE'].apply(ajustar_padrao_codigo)
df_externo['chave_sinapi'] = df_externo['CODIGO_ORSE'].apply(ajustar_padrao_codigo)

# Merge
df_merge = pd.merge(
    df_interno, 
    df_externo[['chave_sinapi', 'CUSTO_UNIT.']], 
    on='chave_sinapi', 
    how='left'
)
# Substituição do Preço pelo Custo Atual
df_merge['PRECO_UNIT'] = df_merge['CUSTO_UNIT.'].fillna(df_merge['PRECO_UNIT'])

# Verificação
matches = df_merge[df_merge['CUSTO_UNIT.'].notna()]
print(f"Total de Matches encontrados: {len(matches)}")
if not matches.empty:
    print("\nExemplos de CÓDIGOS ajustados:")
    print(matches[['CODIGO_ORSE', 'chave_sinapi', 'PRECO_UNIT']].head())

df_final = df_merge.drop(columns=['chave_sinapi', 'CUSTO_UNIT.'])

#  Limpeza e Cálculo Numérico
df_final['PRECO_UNIT'] = df_final['PRECO_UNIT'].apply(limpar_valor_real)
df_final['QUANT'] = df_final['QUANT'].apply(limpar_valor_real)
df_final['Valor Parcial'] = df_final['PRECO_UNIT'] * df_final['QUANT']
df_final['ITEM'] = df_final['ITEM'].str.strip()
df_final['PONTOS'] = df_final['ITEM'].str.count(r'\.')

# Garantir tipos corretos
df_final['ITEM'] = df_final['ITEM'].astype(str).str.strip()

df_final['Valor Parcial'] = pd.to_numeric(
    df_final['Valor Parcial'],
    errors='coerce'
).fillna(0)

# Quantidade de níveis
df_final['PONTOS'] = df_final['ITEM'].str.count('\.')

# coluna resultado
df_final['soma_parcial'] = 0

for i, row in df_final.iterrows():

    item = row['ITEM']
    nivel = row['PONTOS']

    filhos = df_final[
        # Altere essa linha:
        df_final['ITEM'].str.startswith(str(item) + '.')
    ]

    if not filhos.empty:

        soma = filhos['Valor Parcial'].sum()

        # níveis 4,3,2 atualizam Valor Parcial
        if nivel >= 2:
            df_final.loc[i, 'Valor Parcial'] = soma

        # nível 1 vai para soma_parcial
        if nivel == 1:
           df_final['soma_parcial'] = df_final['soma_parcial'].astype(float)
           df_final.loc[i, 'soma_parcial'] = soma

df_final['ITEM_KEY'] = pd.to_numeric(df_final['ITEM'], errors='coerce') # Converte para numérico para ignorar se é "01" ou "1"
df_final['PAI_N1'] = df_final.apply(lambda x: pd.to_numeric(".".join(x['ITEM'].split('.')[:-3]), errors='coerce')  if x['PONTOS'] == 3 else None, axis=1)
soma_n1 = df_final.groupby('PAI_N1')['Valor Parcial'].sum().reset_index()
soma_n1.columns = ['ITEM_KEY', 'SOMA_N1']
df_final = pd.merge(df_final, soma_n1, on='ITEM_KEY', how='left')
df_final['Soma'] = df_final['SOMA_N1'].fillna(0)
#df_final = df_final.drop(columns=['PONTOS','Base_Soma','Soma_Hierarquica','codigo_pai'])

#Percentual
# valor base
df_final['valor_base'] = df_final['Valor Parcial']

# nível 1 usa soma_parcial
mask_n1 = df_final['PONTOS'] == 1
df_final.loc[mask_n1, 'valor_base'] = df_final.loc[mask_n1, 'soma_parcial']

# descobrir setor 
df_final['SETOR'] = df_final['ITEM'].str.split('.').str[0]

# total de cada setor
totais_setor = (
    df_final[df_final['PONTOS'] == 1]
    .groupby('SETOR')['valor_base']
    .sum()
)
# mapear total do setor para cada linha
df_final['total_setor'] = df_final['SETOR'].map(totais_setor)
# calcular percentual
df_final['Parcial (%)'] = (df_final['valor_base'] / df_final['total_setor']) *2

total_obra = df_final['Soma'].sum()
print(total_obra/2)
# calcular percentual
df_final['(%)'] = (df_final['Soma'] / total_obra) * 2

# Valor Total
indices = df_final[
    (df_final['CODIGO_ALTO'] == "ESPCAR_01") & 
    (df_final['DESCRIÇÃO DO ITEM'] == "Valor Total")
].index

#  Obras Complementares 
indiceObras = df_final[
    (df_final['CODIGO_ALTO'] == "ESPCAR_01") & 
    (df_final['DESCRIÇÃO DO ITEM'] == "Obras Complementares")
].index

# SubTotal Obras Complementares
indiceSubObras = df_final[
    (df_final['CODIGO_ALTO'] == "ESPCAR_01") &
    (df_final['DESCRIÇÃO DO ITEM'] == "Subtotal - Obras Complementares")
].index

#SubTotal Áreas de Risco
indiceSub = df_final[
    (df_final['CODIGO_ALTO'] == "ESPCAR_01") & 
    (df_final['DESCRIÇÃO DO ITEM'] == "Subtotal - Áreas de Risco")
].index

total_geral = df_final['soma_parcial'].sum()
total_geral = total_geral/2

#Soma de intervenções
indiceInter = df_final[
    (df_final['CODIGO_ALTO'] == "ESPCAR_01") & 
    (df_final['DESCRIÇÃO DO ITEM'] == "Subtotal - Áreas de Risco")
].index
df_final.loc[indices, "Soma"] = total_geral

#Obras Complemenentares
valorObra = df_final.loc[indiceObras, "Soma"] 
valorObra = float(valorObra.max())
df_final.loc[indiceSubObras, "Soma"] = valorObra

sub = total_geral - valorObra
sub = float(sub.max())
df_final.loc[indiceSub, "Soma"] = sub

# Verificação Final
print("\n--- Verificação Final ESPCAR_01 ---")
print(df_final.loc[indices.union(indiceSubObras).union(indiceSub), ['DESCRIÇÃO DO ITEM', 'Soma']])

df_exibicao = df_final.copy() 
df_exibicao= df_exibicao.drop_duplicates() #Remove duplicatas
colunas_moeda = ['PRECO_UNIT', 'Valor Parcial', 'soma_parcial', 'Soma']

for col in colunas_moeda:
    if col in df_exibicao.columns:
        df_exibicao[col] = df_exibicao[col].map(formatar_brl_final).astype(str)
        
with pd.ExcelWriter("Relatorio_2025_12.xlsx", engine='xlsxwriter') as writer:
    df_exibicao.to_excel(writer, index=False, sheet_name='Carvalho')
    
    workbook  = writer.book
    worksheet = writer.sheets['Carvalho']

    # Criamos um formato específico para porcentagem
    formato_porcentagem = workbook.add_format({'num_format': '0.00%'})

    # Iteramos pelas colunas para ajustar largura e aplicar formato onde necessário
    for i, col_name in enumerate(df_exibicao.columns):
        # Se a coluna for a de índice 9 (
        if i in [9, 11]:
            worksheet.set_column(i, i, 18, formato_porcentagem)
        else:
            worksheet.set_column(i, i, 18)


#Criar json

json = df_exibicao.to_json(path_or_buf='Relatorio122025.json',
    orient='records',
    force_ascii=False,
    indent=4)

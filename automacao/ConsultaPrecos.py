import pandas as pd
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


#  Garantir tipos de dados corretos para o cálculo
df_final['ITEM'] = df_final['ITEM'].astype(str).str.strip()
df_final['Valor Parcial'] = pd.to_numeric(
    df_final['Valor Parcial'],
    errors='coerce'
).fillna(0)

# Função para identificar o pai hierárquico
def identificar_pai(item):
    if not item or item == 'None':
        return None

    partes = item.split('.')

    # Ex: '04.02' → pai = '4'
    if len(partes) == 2:
        try:
            return str(int(partes[0]))
        except ValueError:
            return partes[0]

    # Ex: '04.02.002.001' → '04.02.002'
    if len(partes) > 2:
        return ".".join(partes[:-1])

    # Nível raiz não tem pai
    return None

# Criar coluna base (NUNCA é alterada)
df_final['Base_Soma'] = df_final['Valor Parcial']

# Dicionário inicial
soma_hierarquica = dict(
    zip(df_final['ITEM'], df_final['Base_Soma'])
)

# Soma hierárquica POR CAMADA
niveis = sorted(df_final['PONTOS'].unique(), reverse=True)

for nivel in niveis:
    filhos = df_final[df_final['PONTOS'] == nivel]

    for _, row in filhos.iterrows():
        filho = row['ITEM']
        pai = identificar_pai(filho)

        if pai in soma_hierarquica:
            # o pai recebe o valor FINAL do filho
            soma_hierarquica[pai] += soma_hierarquica[filho]

#  Mapear resultado final
df_final['Soma_Hierarquica'] = df_final['ITEM'].map(soma_hierarquica)

mask = (
    df_final['PONTOS'].isin([2, 3])
) & (
    df_final['Soma_Hierarquica'].notna()
)

df_final.loc[mask, 'Valor Parcial'] = df_final.loc[mask, 'Soma_Hierarquica']


df_final['PONTOS'] = df_final['ITEM'].str.count('\.')

# Criar uma coluna identificando quem é o "Pai" de cada item (para nivel 4)
# Ex: 04.02.002.001 vira 04.02.002
df_final['codigo_pai'] = df_final['ITEM'].str.rsplit('.', n=2).str[0]

#Calcular a soma dos filhos para cada pai
soma_filhos = df_final[df_final['PONTOS'] == 4].groupby('codigo_pai')['Valor Parcial'].sum()

#  Atualizar o valor dos pais (3 pontos) com a soma calculada
# Transformamos a soma em um dicionário para facilitar o mapeamento
mapa_somas = soma_filhos.to_dict()

def atualizar_valor(row):
    # Se for um item de 2 pontos e existir uma soma para ele, atualiza
    if row['PONTOS'] == 2 and row['ITEM'] in mapa_somas:
        return mapa_somas[row['ITEM']]
    return row['Valor Parcial']


df_final['Valor Parcial'] = df_final.apply(atualizar_valor, axis=1)
mask = (df_final['ITEM'].isin(mapa_somas.keys())) & (df_final['ITEM'].str.count('\.') == 3)

df_final.loc[mask, 'Valor Parcial'] = df_final['ITEM'].map(mapa_somas)

df_final['PAI_N2'] = df_final.apply(lambda x: ".".join(x['ITEM'].split('.')[:-2]) if x['PONTOS'] == 3 else None, axis=1)
soma_n2 = df_final.groupby('codigo_pai')['Valor Parcial'].sum().reset_index().rename(columns={'codigo_pai': 'ITEM', 'Valor Parcial': 'SOMA_N2'})
df_final = pd.merge(df_final, soma_n2, on='ITEM', how='left').fillna(0)
df_final['soma_parcial'] = df_final['SOMA_N2']

df_final['ITEM_KEY'] = pd.to_numeric(df_final['ITEM'], errors='coerce') # Converte para numérico para ignorar se é "01" ou "1"
df_final['PAI_N1'] = df_final.apply(lambda x: pd.to_numeric(".".join(x['ITEM'].split('.')[:-3]), errors='coerce')  if x['PONTOS'] == 3 else None, axis=1)
soma_n1 = df_final.groupby('PAI_N1')['Valor Parcial'].sum().reset_index()
soma_n1.columns = ['ITEM_KEY', 'SOMA_N1']
df_final = pd.merge(df_final, soma_n1, on='ITEM_KEY', how='left')
df_final['Soma'] = df_final['SOMA_N1'].fillna(0)

#df_final = df_final.drop(columns=['PONTOS','Base_Soma','Soma_Hierarquica','codigo_pai'])

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
percentual = 5
Projeto = (percentual/100) * total_geral
print(Projeto)

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

json = df_exibicao.to_json(path_or_buf='Relatorio122024.json',
    orient='records',
    force_ascii=False,
    indent=4)

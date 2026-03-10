import pandas as pd
import os
import re

# Caminhos dos arquivos
caminho_interno = r"automacao/interno_fixo/Relatório03_Volume01_Planilha_V05.xlsx"
caminho_externo = r"automacao/Tabela_codigos_limpo.xlsx"

def limpar_geral(texto):
    """Limpa espaços extras, quebras de linha e trata nulos."""
    if pd.isna(texto): 
        return ""
    texto = str(texto).replace('\n', ' ')
    return re.sub(r'\s+', ' ', texto).strip()

def processar_excel_interno(caminho, nome_aba):
    if not os.path.exists(caminho):
        print(f"Erro: O arquivo '{caminho}' não foi encontrado.")
        return None

    try:
        print(f"Lendo dados da aba '{nome_aba}'...")
        # Lendo a aba e pulando as linhas de cabeçalho irrelevantes
        df = pd.read_excel(caminho, sheet_name=nome_aba, skiprows=3)
        
        # Remove colunas e linhas totalmente vazias
        df = df.dropna(axis=1, how="all").dropna(axis=0, how="all")
        
        # Aplica a limpeza em todas as colunas de texto
        for col in df.columns:
            df[col] = df[col].apply(limpar_geral)
        
        print(f"Sucesso: {len(df)} linhas carregadas do arquivo interno.")
        return df
    except Exception as e:
        print(f"Erro ao processar o Excel interno: {e}")
        return None

def processar_excel_externo(caminho):
    if not os.path.exists(caminho):
        print(f"Erro: O arquivo '{caminho}' não foi encontrado.")
        return None
    try:
        print("Lendo os dados externos...")
        dfe = pd.read_excel(caminho)
        
        # Limpeza preventiva
        dfe = dfe.dropna(axis=1, how="all")
        for col in dfe.columns:
            dfe[col] = dfe[col].apply(limpar_geral)
            
        print(f"Sucesso: {len(dfe)} linhas carregadas do arquivo externo.")
        return dfe
    except Exception as e:
        print(f"Erro ao processar o Excel externo: {e}")
        return None
    
def realizar_merge(df_int, df_ext, coluna_chave):
    """
    Une os dois DataFrames com base em uma coluna comum.
    Ex: 'Código', 'Item' ou 'Descrição'.
    """
    print(f"Realizando merge pela coluna: {coluna_chave}...")
    
    # Realiza o merge (Left Join: mantém a estrutura do seu relatório interno)
    df_consolidado = pd.merge(
        df_int, 
        df_ext, 
        on=coluna_chave, 
        how='left', 
        suffixes=('_interno', '_externo')
    )
    
    return df_consolidado


# --- Execução ---
aba_alvo = '01_Carvalho'

df_interno = processar_excel_interno(caminho_interno, aba_alvo)
df_externo = processar_excel_externo(caminho_externo)


# 2. Criar colunas temporárias "limpas" para o cruzamento
# Isso mantém a descrição original intacta, mas usa uma versão padronizada para a busca
df_interno['desc_search'] = df_interno['DESCRIÇÃO DO ITEM'].apply(limpar_geral)
df_externo['desc_search'] = df_externo['DESCRIÇÃO'].apply(limpar_geral)

# 3. Executar o Merge usando as colunas limpas
df_externo = pd.merge(
    df_interno, 
    df_externo[['desc_search', 'SERVIÇO']], 
    on='desc_search', 
    how='left'
)

# 4. Atribuir o código e remover colunas temporárias
df_externo['CODIGO_ORSE'] = df_externo['SERVIÇO']
df_externo = df_externo.drop(columns=['desc_search', 'SERVIÇO'])

df_externo = df_externo.drop_duplicates()


# 5. Salvar
df_externo.to_excel('Relatorio_{aba_alvo}.xlsx', index=False)


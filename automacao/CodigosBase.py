import pandas as pd
import os
import re

# Caminhos dos arquivos
caminho_interno = r"tabela_codigos.xlsx"

def limpar_geral(texto):
    """Limpa espaços extras, quebras de linha e trata nulos."""
    if pd.isna(texto): 
        return ""
    texto = str(texto).replace('\n', ' ')
    return re.sub(r'\s+', ' ', texto).strip()

def processar_excel_interno(caminho):
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
    
df_interno = processar_excel_interno(caminho_interno)

df_interno = df_interno.drop_duplicates()
# 5. Salvar
df_interno.to_excel('Tabela_codigos_limpo.xlsx', index=False)

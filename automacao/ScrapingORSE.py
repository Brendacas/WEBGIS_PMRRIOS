import pandas as pd
from playwright.sync_api import sync_playwright
from datetime import datetime


def rodar_automacao_em_lote():
    hoje = datetime.now()
    ano_atual = hoje.year
    mes_atual = hoje.month

    # 2. Aplicar a sua regra condicional
    if mes_atual < 6:
        # Se mês < 6, pega Dezembro do ano anterior
        periodo_valor = f"{ano_atual - 1}-12-1"
    else:
        # Se mês >= 6, pega Junho do ano atual
        periodo_valor = f"{ano_atual}-06-1"
    print(f"Selecionando o período: {periodo_valor}")
    # 1. Carrega a planilha original
    caminho_input = 'automacao/Tabela_codigos_limpo.xlsx'
    df_input = pd.read_excel(caminho_input)

    resultados_finais = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        for index, linha_excel in df_input.iterrows():
            termo = str(linha_excel['DESCRIÇÃO'])
            print(f"Processando linha {index + 1}: {termo}")

            try:
                page.goto('https://orse.cehop.se.gov.br/servicosargumento.asp')
                
                # Ajuste no seletor de período para garantir que o valor exista
                page.select_option('select[name="sltPeriodo"]', value="2025-12-1")
                
                page.locator('input[name="txtDescricao"]').fill(termo)
                page.click('input[name="Submit"]')
                
                page.wait_for_load_state("networkidle")
                
                # Buscando as linhas que contém a classe da tabela do ORSE
                linhas_tabela = page.query_selector_all('tr:has(td.CorpoTabela)')
                
                if len(linhas_tabela) > 0:
                    for tr in linhas_tabela:
                        colunas = tr.query_selector_all('td.CorpoTabela')
                        if len(colunas) >= 4:
                            resultados_finais.append({
                                'DESCRIÇÃO ORIGINAL': termo,
                                'CODIGO_ORSE': colunas[0].inner_text().strip(),
                                'DESCRIÇÃO DO SERVIÇO': colunas[1].inner_text().strip(),
                                'UNIDADE': colunas[2].inner_text().strip(),
                                'CUSTO_UNIT.': colunas[3].inner_text().strip(),
                                'STATUS': 'Encontrado'
                            })
                else:
                    print(f"Item '{termo}' não encontrado.")
                    resultados_finais.append({
                        'DESCRIÇÃO ORIGINAL': termo,
                        'CODIGO_ORSE': 'N/A',
                        'DESCRIÇÃO DO SERVIÇO': 'Não encontrada',
                        'UNIDADE': 'N/A',
                        'CUSTO_UNIT.': 'N/A',
                        'STATUS': 'Não encontrada'
                    })

            except Exception as e:
                print(f"Erro ao processar '{termo}': {e}")
                # Opcional: Adicionar à lista como erro para não perder a linha
                
            page.wait_for_timeout(1000)

        browser.close()

    # 3. Gerando o Excel
    df_resultados = pd.DataFrame(resultados_finais)
    caminho_saida = f'automacao/Resultado_Consulta_ORSE_{periodo_valor}.xlsx'
    
    # Ordena as colunas para garantir que a ordem faça sentido
    colunas_ordenadas = ['DESCRIÇÃO ORIGINAL', 'CODIGO_ORSE', 'DESCRIÇÃO DO SERVIÇO', 'UNIDADE', 'CUSTO_UNIT.', 'STATUS']
    df_resultados = df_resultados[colunas_ordenadas]
    
    df_resultados = df_resultados.drop_duplicates()
    
    df_resultados.to_excel(caminho_saida, index=False)
    print(f"\nAutomação finalizada! Resultados salvos em: {caminho_saida}")

if __name__ == "__main__":

    rodar_automacao_em_lote()
# Projeto de Vida — Especificação funcional

## Objetivo
Painel privado, compartilhado por duas pessoas, para gerir finanças pessoais e empresariais, dívidas, rotina, metas, projetos e execução do plano de seis meses. O sistema deve ser utilizável no celular e desktop, em português brasileiro, com valores em BRL e datas no padrão brasileiro.

## Princípios inegociáveis
1. Separar patrimônio e movimentações pessoais das empresariais.
2. Não classificar salário CLT, renda pessoal de aplicativo ou transferência pessoal como faturamento empresarial automaticamente.
3. Cada lançamento registra origem, destino, titular, natureza, categoria, operação, data, comprovante opcional e observações.
4. Transferências entre contas próprias são transferências, não receita nem despesa consolidada.
5. Nunca inventar saldos, lucros, metas ou dados. Campos não informados aparecem como "A preencher".
6. Todo dado financeiro deve ter trilha de auditoria (criado por, criado em, atualizado por, atualizado em).
7. A aplicação deve suportar duas contas de usuário, autenticação, autorização por família/workspace e RLS em todas as tabelas.
8. Não usar dados fictícios como se fossem reais. Dados de demonstração devem ser claramente marcados e removíveis.

## Navegação principal
- Visão geral
- Mapa mental
- Financeiro
- Dívidas
- Operações
  - Uber / 99
  - Venda de bebidas
  - MIMORA / Kaiross
  - Loja de roupas (projeto futuro)
- Plano de 6 meses
- Rotina e tarefas
- Projetos e prioridades
- Biblioteca de conhecimento
- Regras e decisões
- Relatórios
- Configurações / membros

## Visão geral
Cards: saldo consolidado por titular e por conta (sem esconder separação), entradas do mês, saídas do mês, resultado operacional por operação, parcelas a vencer, tarefas de hoje, metas em risco, reserva financeira e patrimônio líquido. Gráficos de fluxo de caixa, receitas/despesas por categoria e evolução do patrimônio. Filtros por período, titular, conta e operação.

## Mapa mental interativo
Mapa hierárquico com nós expansíveis/recolhíveis, zoom, pan, pesquisa, filtros, criação/edição/exclusão de nós, notas por nó, links para módulos, status, prioridade, responsável e prazo. Raiz: Projeto de Vida. Ramos: Finanças; Dívidas; Renda e operações; Família; Rotina; Saúde e energia; Conhecimento; Patrimônio e investimentos; Metas de 6 meses. Cada nó deve poder conter subtópicos, tarefas, métricas, notas e anexos. Oferecer também visualização em lista/outline para acessibilidade e telas pequenas.

## Financeiro
- Contas: pessoal do usuário, pessoal da companheira, empresarial (quando formalizada), dinheiro em espécie e outras contas.
- Lançamentos: receita, despesa, transferência, aporte, retirada, reembolso, ajuste; classificação separada da categoria contábil/fiscal.
- Campos: valor, data, competência, conta origem/destino, titular, operação, categoria, descrição, recorrência, comprovante, status conciliado.
- Orçamentos mensais por categoria e por operação.
- Regras de conciliação e prevenção de duplicidade.
- Painel de caixa realizado e previsto.
- Importação CSV futura; exportação CSV e PDF.
- Transferências não contam como receita/despesa no consolidado.
- Salário da companheira deve ser renda pessoal, salvo formalização específica de outra natureza.
- Receitas de Uber/99 devem pertencer ao prestador/titular correto; não presumir que são receitas do CNPJ.
- Aportes ao negócio devem ser classificados e documentados como aporte ou mútuo conforme orientação contábil.
- Conta empresarial recebe apenas recursos cuja natureza e titularidade sejam juridicamente compatíveis.

## Dívidas
Cadastro por contrato/credor: valor originalmente recebido, valor financiado, CET anual/mensal, taxa, número de parcelas, valor e periodicidade, parcelas pagas/abertas, vencimento, saldo devedor informado, valor para quitação antecipada, seguros/tarifas, garantias, atraso e documentos.
Mostrar cronograma, custo total contratado (não confundir com saldo devedor), amortização, próximos vencimentos e cenários de antecipação. Registrar o empréstimo mencionado: refinanciamento aproximado de R$16.000, 108 parcelas estimadas de R$566; marcar todos esses números como estimativas até validar contrato. Não calcular saldo devedor como 108 × parcela.

## Operação Uber / 99
Registro diário: plataforma, horas online, horas efetivas, km inicial/final, corridas, faturamento bruto, gorjetas/bonificações, combustível (litros e valor), aluguel do carro (rateio por dia/semana), pedágios, estacionamento, lavagem, manutenção, alimentação em trabalho, taxas e outros custos. Indicadores calculados: receita bruta, custo variável, custo fixo alocado, resultado operacional, receita/hora, lucro/hora, receita/km, custo/km, km vazio, taxa de ocupação, meta diária e semanal. Não tratar faturamento bruto como lucro. Custo conhecido atual: aluguel R$735/semana (estimativa equivalente mensal R$3.185 usando 52/12), sujeito a confirmação.

## Operação venda de bebidas
Por evento/dia: local, data, autorização/regras do local, estoque inicial, unidade, custo unitário, preço de venda, quantidade vendida, perdas, sobras, gelo, transporte, taxas, ajudantes, horas trabalhadas e recebimentos. Calcular faturamento, CMV, margem bruta, despesas do evento, lucro líquido, giro de estoque, lucro/hora e capital imobilizado. Não recomendar expansão de estoque/equipamentos sem dados de giro e autorização.

## Operação MIMORA / Kaiross
Funil por campanha e produto: gasto em anúncios, impressões, alcance, cliques, conversas, leads qualificados, pedidos, pagamentos aprovados, cancelamentos, reembolsos, receita, taxas, custo do produto/fornecedor conforme relatório líquido da plataforma, frete e contribuição por pedido. Se o painel Kaiross já informa valor líquido com custo do fornecedor, taxas, NF e frete deduzidos, não deduzir esses itens novamente. Calcular CPM, CPC, custo por conversa, custo por lead qualificado, conversão conversa-pedido, CAC, ticket médio, margem de contribuição e ROAS. Não escalar apenas por volume de mensagens; exigir vendas e margem positivas. Campanhas em teste devem estar sinalizadas como teste.

## Loja de roupas — projeto futuro
Backlog sem capital comprometido até validação. Registrar fornecedor, produto, custo total posto, preço, margem, lote mínimo, estoque, devoluções, vendas e demanda. Permitir teste de pequena escala, pré-venda ou consignação conforme viabilidade. Não misturar estoque ou posicionamento de marca sem decisão estratégica.

## Plano de 6 meses
Plano de 180 dias contado da data de ativação. Seis fases mensais:
Mês 1 — Diagnóstico e controle: inventário de contas, despesas, contratos, dívida, orçamento, rotina de fechamento diário, custos reais de Uber/99 e linha de base das operações.
Mês 2 — Estabilização: regularidade de renda, controle de custos, pagamento pontual de obrigações, primeira reserva e revisão das campanhas MIMORA.
Mês 3 — Otimização: elevar lucro/hora, melhorar conversão de MIMORA, validar economia de bebidas por evento e reduzir desperdícios.
Mês 4 — Consolidação: documentar processos, avaliar formalização e enquadramento empresarial com contador, revisar o acordo futuro do veículo e fortalecer reserva.
Mês 5 — Validação de expansão: estudar loja de roupas e outras expansões apenas com dados, orçamento limitado e teste pequeno; comparar retorno e risco.
Mês 6 — Revisão estratégica: fechar DRE gerencial por operação, revisar dívida e patrimônio, medir metas, definir próximo ciclo de 6 meses.
Cada mês contém objetivos, marcos, tarefas, responsável, prazo, orçamento, evidência de conclusão, status e retrospectiva. As metas numéricas permanecem "A definir" até inserção de dados reais.

## Rotina diária
- Início do dia (10–15 min): consultar caixa, compromissos, vencimentos, clima/agenda operacional se relevante, definir 3 prioridades e meta de trabalho.
- Antes de dirigir: verificar veículo, combustível, documentação, custos e meta de horas.
- Durante Uber/99: registrar blocos de trabalho, ganhos, km e despesas; não depender de memória no fim do dia.
- Bebidas: checklist de autorização, estoque, gelo, transporte, preços, meios de pagamento, vendas, perdas e fechamento.
- MIMORA: revisar orçamento, mensagens/leads, pedidos, pagamentos, cancelamentos e margem; evitar alterações impulsivas em campanhas com pouca amostra.
- Bloco administrativo (30–60 min conforme agenda): tarefas críticas, fornecedores, notas, conciliação, projetos.
- Fechamento (15–20 min): conferir entradas/saídas, classificar transações, registrar km/horas, verificar caixa e preparar amanhã.
- Sono, alimentação, descanso e compromissos pessoais devem ser planejados; não transformar rotina em jornada insustentável.
Permitir modelos de rotina por dia da semana e tarefas recorrentes.

## Rotina semanal
Reunião do casal de 40 minutos: saldos por conta; entradas/saídas; dívidas e vencimentos; resultado de cada operação; campanhas; estoque; prioridades; agenda da semana; decisões registradas. Criar fechamento semanal e revisão de metas.

## Regras do projeto
- Não assumir nova dívida de consumo.
- Não comprometer receita futura sem conhecer caixa.
- Não misturar contas pessoais e empresariais.
- Não lançar transferências como faturamento.
- Não usar salário pessoal como receita empresarial sem base legal/documental.
- Registrar toda retirada e aporte.
- Não escalar anúncios sem vendas e margem de contribuição positivas.
- Não comprar estoque/equipamentos sem validação de demanda e regras do local.
- Não gastar reserva para despesas ordinárias ou expansão especulativa.
- Antes de crédito: identificar ativo/atividade, CET, fonte de pagamento e cenário pessimista.
- Banco aprovar crédito não significa que o investimento é bom.
- Não tratar valorização de ativo como caixa disponível.
- Registrar decisões relevantes, premissas, riscos e data de revisão.

## Biblioteca de conhecimento
Guardar aprendizados de vídeos e estudos como notas estruturadas. Entradas 01: educação financeira (gerar, preservar e multiplicar; valor do tempo; inflação; juros compostos; reserva; orçamento; impostos; patrimônio e fluxo de caixa). Entrada 02: alavancagem financeira (amplifica ganhos e perdas; CET; fluxo de caixa; liquidez; estresse de cenários; dívida produtiva não é automaticamente boa). Permitir notas, tags, fontes, resumos e ações práticas.

## Segurança e privacidade
Autenticação obrigatória. Workspace privado do casal, convites individuais, papéis owner/admin/member, RLS por workspace em todas as tabelas, validação server-side, logs de auditoria, proteção contra exposição de chaves. Não colocar dados bancários sensíveis, senhas, tokens ou documentos pessoais em texto livre. Não publicar o app até revisar as políticas de acesso e RLS.

## Critérios de aceite
- Criar, editar, excluir e pesquisar contas, transações, dívidas, projetos, tarefas, notas e metas.
- Dashboard recalcula totais a partir dos lançamentos.
- Mapa mental suporta edição de nós e notas persistentes.
- Dois usuários conseguem acessar o mesmo workspace com login separado.
- RLS impede acesso de outro workspace.
- Responsivo para celular.
- Dados exportáveis.
- Valores desconhecidos exibidos como pendentes, sem valores fictícios.
- Testes para cálculos financeiros, transferências e permissões.

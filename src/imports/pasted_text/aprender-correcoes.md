Analise o projeto atual do Aprender+ no Figma Make e corrija apenas as funcionalidades abaixo.

Não refaça o sistema do zero.
Não altere o visual além do necessário para os estados funcionais.
Mantenha as telas atuais, mas faça os botões, modais, listas e fluxos funcionarem corretamente.

Contexto rápido:
O Aprender+ possui dois tipos de usuários: Professor e Administrador.
O aluno não acessa o sistema.
O professor faz chamada, registra conteúdo, faz avaliação diária, gera avaliação periódica e aplica prova oral.
O administrador gerencia cursos, módulos, turmas, professores, alunos e banco de questões.

Faça as seguintes correções:

1. Criar tela de login para Professor e Administrador

Criar uma tela inicial de login funcional.

A tela deve permitir selecionar o tipo de acesso:

- Professor
- Administrador

Comportamento esperado:

- Se o usuário selecionar “Professor” e clicar em “Entrar”, deve ser levado ao Dashboard do Professor.
- Se selecionar “Administrador” e clicar em “Entrar”, deve ser levado ao Dashboard Administrativo.
- Se os campos obrigatórios estiverem vazios, mostrar erro visual simples.
- O aluno não deve aparecer como opção de login.

2. Corrigir fechamento do modal/card “Justificar falta”

Atualmente, clicar fora do card/modal de justificar falta não fecha o modal.

Corrigir para funcionar assim:

- Ao abrir o modal de justificar falta, clicar fora dele deve fechar o modal.
- Clicar no botão de fechar também deve fechar.
- Clicar dentro do modal não deve fechar.
- Ao salvar a justificativa, o aluno deve mudar para o status “Justificada”.
- A justificativa salva deve ficar visível no aluno ou no resumo da chamada.

3. Corrigir scroll da avaliação diária

A tela de avaliação diária não está rolando corretamente.

Corrigir:

- A lista de alunos da avaliação diária precisa ter scroll vertical.
- O scroll deve funcionar no mobile.
- Nenhum aluno pode ficar inacessível.
- O botão de salvar avaliação diária deve continuar acessível.
- Se houver menu inferior fixo, ele não pode cobrir o conteúdo.

4. Desabilitar lições já ministradas

Na tela de registro de conteúdo, as lições já ministradas não podem ser selecionadas.

Corrigir:

- Lições já ministradas devem ficar desabilitadas.
- O usuário não deve conseguir clicar ou selecionar essas lições.
- Apenas lições ainda não ministradas podem ser selecionadas.
- Se possível, mostrar o status “Já ministrada” nas lições bloqueadas.

Exemplo:

- Lição 1 — Já ministrada — disabled
- Lição 2 — Já ministrada — disabled
- Lição 3 — Disponível
- Lição 4 — Disponível

5. Corrigir avaliação oral/verbal para usar as perguntas sorteadas

Na avaliação oral, as perguntas exibidas devem ser as perguntas selecionadas/sorteadas na etapa de geração da prova.

Regra correta:

- O professor escolhe a quantidade de perguntas por dificuldade.
- Exemplo:
  - 5 fáceis
  - 3 médias
  - 2 difíceis
- O sistema sorteia perguntas da banca de questões.
- Essas perguntas formam uma única prova para a turma.
- Essa mesma prova deve ser aplicada para todos os alunos.
- As notas e observações continuam sendo individuais por aluno.

Corrigir:

- A tela de avaliação oral deve exibir o enunciado real da questão sorteada.
- Não deve exibir apenas critérios gerais.
- Os critérios aparecem apenas para avaliação da resposta.

Na tela da prova oral, mostrar:

- Nome do aluno atual
- Número da questão atual
- Enunciado da questão sorteada
- Dificuldade da questão
- Critérios de nota:
  - Criatividade
  - Domínio da disciplina
  - Concisão
  - Objetividade
- Campo de observação
- Botão de próxima questão
- Botão de questão anterior
- Botão de finalizar aluno

6. Corrigir botões de criar, editar e excluir turma

Na área administrativa, os botões de turma não estão funcionando.

Corrigir:

- “Criar turma” deve abrir formulário/modal de criação.
- “Editar turma” deve abrir o formulário com os dados atuais preenchidos.
- “Excluir turma” deve abrir confirmação antes de excluir.
- Ao criar, a turma deve aparecer na lista.
- Ao editar, a turma deve ser atualizada na lista.
- Ao excluir, a turma deve sair da lista.

Campos mínimos da turma:

- Nome da turma
- Curso vinculado
- Professor responsável
- Horário
- Status
- Alunos vinculados

7. Corrigir botões de editar e excluir aluno

Na área administrativa, os botões de aluno não estão funcionando.

Corrigir:

- “Editar aluno” deve abrir formulário com os dados preenchidos.
- “Excluir aluno” deve pedir confirmação antes de excluir.
- Ao editar, atualizar o aluno na lista.
- Ao excluir, remover o aluno da lista.

Campos mínimos do aluno:

- Nome completo
- Identificação ou e-mail
- Turma vinculada
- Status

Observação:
Aluno não possui login no sistema.

8. Corrigir botão de salvar novo aluno

Atualmente, o botão de salvar ao criar um novo aluno não funciona.

Corrigir:

- Ao clicar em “Salvar aluno”, validar os campos obrigatórios.
- Se estiver correto, adicionar o aluno à lista.
- Mostrar feedback de sucesso.
- Fechar o modal ou limpar o formulário após salvar.
- O aluno recém-criado deve aparecer imediatamente na lista.
- Se faltar campo obrigatório, mostrar erro visual.

9. Corrigir inconsistência entre cursos/módulos e Dashboard Admin

Na tela de cursos e módulos existem 3 cursos que não aparecem no Dashboard do Administrador.

Corrigir:

- O Dashboard Administrativo deve usar a mesma base/mock de dados da tela de cursos e módulos.
- Se existem 3 cursos em cursos/módulos, o Dashboard deve mostrar total de cursos igual a 3.
- Se o Dashboard lista cursos, ele deve listar os mesmos cursos da tela de cursos/módulos.
- Corrigir contadores e listas para não existirem dados divergentes.

10. Corrigir adicionar, editar e excluir módulo

Na tela de cursos e módulos do administrador, os botões de módulo não funcionam.

Corrigir:

- “Adicionar módulo” deve abrir formulário/modal de criação.
- “Editar módulo” deve abrir formulário com dados preenchidos.
- “Excluir módulo” deve pedir confirmação antes de excluir.
- Ao adicionar, o módulo deve aparecer na lista.
- Ao editar, o módulo deve atualizar na lista.
- Ao excluir, o módulo deve sair da lista.

Campos mínimos do módulo:

- Nome do módulo
- Curso vinculado
- Número ou ordem do módulo
- Quantidade de lições
- Status

11. Revisar fluxo completo do Professor

Garantir que o seguinte fluxo funcione:

- Login como Professor
- Entrar no Dashboard do Professor
- Abrir uma turma
- Fazer chamada
- Justificar falta
- Registrar conteúdo ministrado
- Bloquear seleção de lições já ministradas
- Fazer avaliação diária com scroll funcionando
- Configurar avaliação periódica
- Escolher quantidade de questões por dificuldade
- Sortear perguntas da banca
- Aplicar prova oral usando as perguntas sorteadas
- Avaliar individualmente cada aluno
- Registrar notas e observações

12. Revisar fluxo completo do Administrador

Garantir que o seguinte fluxo funcione:

- Login como Administrador
- Entrar no Dashboard Administrativo
- Visualizar dados consistentes de cursos, turmas, alunos e módulos
- Criar, editar e excluir turma
- Criar, editar e excluir aluno
- Criar, editar e excluir módulo
- Cadastrar e gerenciar cursos/módulos
- Manter dados consistentes entre telas

13. Regras técnicas para os dados

Use uma base/mock de dados compartilhada entre as telas.

Evite que cada tela tenha dados separados e inconsistentes.

Os dados precisam atualizar visualmente no protótipo quando o usuário:

- cria um item;
- edita um item;
- exclui um item;
- salva uma justificativa;
- gera uma prova;
- altera status de presença;
- adiciona novo aluno;
- adiciona novo módulo.

14. Ao finalizar

Entregue o projeto com as funcionalidades corrigidas e explique brevemente:

- quais funcionalidades foram corrigidas;
- como testar o login;
- como testar a chamada e justificativa;
- como testar a avaliação diária;
- como testar a geração da prova oral;
- como testar criar, editar e excluir turma;
- como testar criar, editar e excluir aluno;
- como testar criar, editar e excluir módulo;
- como verificar se o Dashboard Admin está consistente com cursos e módulos.
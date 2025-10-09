# 🧬 Mutation Testing com Turbo - Guia Rápido

## ✅ Configuração Completa

Sistema de mutation testing configurado com StrykerJS + Turbo cache inteligente.

## 🚀 Scripts Disponíveis

### Executar em Pacotes Específicos
```bash
# Core package (recomendado para desenvolvimento)
bun run test:mutation:core

# TUI package
bun run test:mutation:tui

# CLI app
bun run test:mutation:cli
```

### Executar em Todos os Pacotes
```bash
# Todos os pacotes (exceto shared)
bun run test:mutation:all

# Todos os pacotes com relatórios detalhados
bun run test:mutation:report

# CI/CD (HTML + JSON reports)
bun run test:mutation:ci
```

### Filtros Avançados
```bash
# Usando filtros do Turbo
bun run test:mutation --filter=@checklist/core
bun run test:mutation --filter=!@checklist/shared

# Execução completa (sem cache)
bun run test:mutation:full

# Limpar e executar
bun run test:mutation:clean
```

## 📊 Cache Inteligente

O Turbo mantém cache baseado em:
- ✅ Arquivos de origem e testes
- ✅ Configurações do Stryker
- ✅ Dependências do pacote
- ✅ Saídas geradas

### Performance do Cache
- **Primeira execução**: `cache miss, executing`
- **Segunda execução**: `cache hit, replaying logs`
- **Ganho de tempo**: ~40% mais rápido com cache

## 📁 Relatórios Gerados

```
reports/mutation/
├── core/index.html     # Relatório visual
├── tui/index.html      # Relatório TUI
├── cli/index.html      # Relatório CLI
└── shared/index.html   # Relatório Shared
```

## 🔧 Scripts por Pacote

Cada pacote tem:
- `test:mutation` - Incremental padrão
- `test:mutation:ci` - CI/CD com reports
- `test:mutation:report` - Relatórios completos
- `test:mutation:full` - Sem cache
- `test:mutation:clean` - Limpa e executa

## 💡 Dicas de Uso

### Para Desenvolvimento
```bash
# Testar apenas o que você está mudando
bun run test:mutation:core

# Execução rápida com cache
bun run test:mutation
```

### Para CI/CD
```bash
# Gerar relatórios para análise
bun run test:mutation:ci
```

### Debug
```bash
# Limpar cache se necessário
bun run test:mutation:clean

# Execução completa sem cache
bun run test:mutation:full
```

## 🎯 Benefícios

- ✅ **Execução Paralela**: Múltiplos pacotes simultaneamente
- ✅ **Cache Inteligente**: Reaproveita resultados anteriores
- ✅ **Relatórios Detalhados**: HTML, JSON e texto
- ✅ **Configuração Flexível**: Por pacote ou global
- ✅ **Integração CI/CD**: Ready para automação

---

**Configurado e testado!** 🎉

Use `bun run test:mutation:core` para começar a testar o mutation testing do seu código.